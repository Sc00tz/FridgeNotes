/**
 * WebSocketManager
 *
 * Singleton wrapper around socket.io-client. Manages connection lifecycle,
 * user/note room membership, event throttling, and batched room operations.
 * Import the default export (`socketClient`) for normal use.
 */

import { io } from 'socket.io-client';

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentUserId = null;
    this.joinedNotes = new Set();
    this.eventListeners = new Map();
    this.reconnectAttempts = 0;
    // Reduced from 5 to limit reconnection storms on flaky networks.
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 2000;
    this.reconnectTimeout = null;

    // Throttle outgoing events to at most 10 per second per note+type key.
    this.eventThrottleMs = 100;
    this.lastEventTime = new Map();

    // Batch join/leave room operations so rapid note opens don't flood the server.
    this.pendingRoomOperations = new Set();
    this.roomOperationTimeout = null;

    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');

    this.serverUrl = `${protocol}//${host}:${port}`;
  }

  connect(userId) {
    if (this.socket && this.isConnected) {
      this.disconnect();
    }

    try {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: this.maxReconnectAttempts,
        upgrade: true,
        rememberUpgrade: true,
      });

      this.currentUserId = userId;
      this.setupEventListeners();

      return this.socket;
    } catch (error) {
      throw error;
    }
  }

  setupEventListeners() {
    if (!this.socket) {
      return;
    }

    // Remove previously registered listeners to prevent duplicates on reconnect.
    this.socket.removeAllListeners();

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;

      if (this.currentUserId) {
        this.joinUser(this.currentUserId);
      }

      if (this.joinedNotes.size > 0) {
        this.joinedNotes.forEach(noteId => {
          this.joinNote(noteId);
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (reason === 'io server disconnect') {
        // Server-initiated disconnect — socket.io won't auto-reconnect, so we do it manually.
        this.reconnectTimeout = setTimeout(() => {
          if (!this.isConnected && this.currentUserId) {
            this.connect(this.currentUserId);
          }
        }, this.reconnectDelay);
      }
    });

    this.socket.on('connect_error', () => {
      this.isConnected = false;
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', () => {});
    this.socket.on('reconnect_failed', () => {});
    this.socket.on('joined_note', () => {});
    this.socket.on('left_note', () => {});
    this.socket.on('user_joined', () => {});
    this.socket.on('user_left', () => {});
    this.socket.on('error', () => {});
    this.socket.on('ping', () => {});
    this.socket.on('pong', () => {});
  }

  disconnect() {
    if (this.socket) {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.roomOperationTimeout) {
        clearTimeout(this.roomOperationTimeout);
        this.roomOperationTimeout = null;
      }
      this.pendingRoomOperations.clear();

      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.joinedNotes.clear();
      this.eventListeners.clear();
      this.currentUserId = null;
      this.reconnectAttempts = 0;
    }
  }

  joinUser(userId) {
    if (!userId || !this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('join_user', { user_id: userId });
  }

  joinNote(noteId) {
    if (!noteId) {
      return;
    }

    this.pendingRoomOperations.add({ type: 'join', noteId });
    this._processPendingRoomOperations();
  }

  _processPendingRoomOperations() {
    // Debounce so a burst of join/leave calls is collapsed into one batch.
    if (this.roomOperationTimeout) {
      clearTimeout(this.roomOperationTimeout);
    }

    this.roomOperationTimeout = setTimeout(() => {
      if (!this.socket || !this.isConnected || !this.currentUserId) {
        return;
      }

      const operations = Array.from(this.pendingRoomOperations);
      this.pendingRoomOperations.clear();

      operations.forEach(op => {
        if (op.type === 'join' && !this.joinedNotes.has(op.noteId)) {
          this.socket.emit('join_note', {
            note_id: op.noteId,
            user_id: this.currentUserId,
          });
          this.joinedNotes.add(op.noteId);
        } else if (op.type === 'leave' && this.joinedNotes.has(op.noteId)) {
          this.socket.emit('leave_note', {
            note_id: op.noteId,
            user_id: this.currentUserId,
          });
          this.joinedNotes.delete(op.noteId);
        }
      });
    }, 50);
  }

  leaveNote(noteId) {
    if (!noteId) {
      return;
    }

    this.pendingRoomOperations.add({ type: 'leave', noteId });
    this._processPendingRoomOperations();
  }

  _shouldThrottleEvent(eventKey) {
    const now = Date.now();
    const lastTime = this.lastEventTime.get(eventKey) || 0;

    if (now - lastTime < this.eventThrottleMs) {
      return true;
    }

    // Evict stale entries to keep the map bounded.
    if (this.lastEventTime.size > 500) {
      const cutoff = now - 60000;
      for (const [key, time] of this.lastEventTime) {
        if (time < cutoff) this.lastEventTime.delete(key);
      }
    }

    this.lastEventTime.set(eventKey, now);
    return false;
  }

  emitNoteUpdate(noteId, updateType, data) {
    if (!this.socket || !this.isConnected || !this.currentUserId) {
      return;
    }

    const eventKey = `note_update_${noteId}_${updateType}`;
    if (this._shouldThrottleEvent(eventKey)) {
      return;
    }

    this.socket.emit('note_updated', {
      note_id: noteId,
      user_id: this.currentUserId,
      update_type: updateType,
      data: data,
    });
  }

  emitChecklistItemToggle(noteId, itemId, completed) {
    if (this.socket && this.isConnected && this.currentUserId) {
      this.socket.emit('checklist_item_toggled', {
        note_id: noteId,
        item_id: itemId,
        completed: completed,
        user_id: this.currentUserId,
      });
    }
  }

  emitNoteShared(noteId, sharedWithUserId, accessLevel) {
    if (this.socket && this.isConnected) {
      this.socket.emit('note_shared', {
        note_id: noteId,
        shared_with_user_id: sharedWithUserId,
        access_level: accessLevel,
      });
    }
  }

  emitNotesReordered(userId, noteIds) {
    if (this.socket && this.isConnected && this.currentUserId) {
      this.socket.emit('notes_reordered', {
        user_id: userId,
        note_ids: noteIds,
      });
    }
  }

  onNoteUpdate(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('note_update_received', callback);
      this.eventListeners.set('note_update_received', callback);
    }
  }

  onChecklistItemToggle(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('checklist_item_toggle_received', callback);
      this.eventListeners.set('checklist_item_toggle_received', callback);
    }
  }

  onNoteShared(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('note_share_received', callback);
      this.eventListeners.set('note_share_received', callback);
    }
  }

  onNotesReordered(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('notes_reorder_received', callback);
      this.eventListeners.set('notes_reorder_received', callback);
    }
  }

  onUserJoined(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('user_joined', callback);
      this.eventListeners.set('user_joined', callback);
    }
  }

  onUserLeft(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('user_left', callback);
      this.eventListeners.set('user_left', callback);
    }
  }

  offNoteUpdate(callback) {
    if (this.socket && callback) {
      this.socket.off('note_update_received', callback);
      this.eventListeners.delete('note_update_received');
    }
  }

  offChecklistItemToggle(callback) {
    if (this.socket && callback) {
      this.socket.off('checklist_item_toggle_received', callback);
      this.eventListeners.delete('checklist_item_toggle_received');
    }
  }

  offNoteShared(callback) {
    if (this.socket && callback) {
      this.socket.off('note_share_received', callback);
      this.eventListeners.delete('note_share_received');
    }
  }

  offNotesReordered(callback) {
    if (this.socket && callback) {
      this.socket.off('notes_reorder_received', callback);
      this.eventListeners.delete('notes_reorder_received');
    }
  }

  offUserJoined(callback) {
    if (this.socket && callback) {
      this.socket.off('user_joined', callback);
      this.eventListeners.delete('user_joined');
    }
  }

  offUserLeft(callback) {
    if (this.socket && callback) {
      this.socket.off('user_left', callback);
      this.eventListeners.delete('user_left');
    }
  }

  isSocketConnected() {
    return this.socket && this.socket.connected && this.isConnected;
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }

  getJoinedNotes() {
    return Array.from(this.joinedNotes);
  }

  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      socketId: this.getSocketId(),
      currentUserId: this.currentUserId,
      joinedNotes: this.getJoinedNotes(),
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      eventListeners: Array.from(this.eventListeners.keys()),
    };
  }

  testConnection() {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping', { timestamp: Date.now(), test: true });
      return true;
    } else {
      return false;
    }
  }

  forceReconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }

    setTimeout(() => {
      if (this.currentUserId) {
        this.connect(this.currentUserId);
      }
    }, 1000);
  }

  healthCheck() {
    return this.isSocketConnected() && !!this.currentUserId;
  }
}

const socketClient = new WebSocketManager();

export default socketClient;

export { WebSocketManager };

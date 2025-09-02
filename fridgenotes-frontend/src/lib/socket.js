// FridgeNotes WebSocket Manager
import { io } from 'socket.io-client';

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentUserId = null;
    this.joinedNotes = new Set();
    this.eventListeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // OPTIMIZED: Reduced from 5 to limit reconnection storms
    this.reconnectDelay = 2000;    // OPTIMIZED: Increased base delay
    this.reconnectTimeout = null;
    
    // OPTIMIZATION: Add throttling for WebSocket events
    this.eventThrottleMs = 100;    // Throttle events to max 10/second
    this.lastEventTime = new Map();
    
    // OPTIMIZATION: Batch note room operations
    this.pendingRoomOperations = new Set();
    this.roomOperationTimeout = null;
    
    // Get the base URL for the socket connection
    // Use the current window location 
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    
    // Use the same protocol and port as the current page
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
        rememberUpgrade: true
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

    // Connection event listeners
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Rejoin all previously joined note rooms
      if (this.joinedNotes.size > 0) {
        this.joinedNotes.forEach(noteId => {
          this.joinNote(noteId);
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      
      // Clear any existing reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Don't clear joinedNotes here so we can rejoin on reconnect
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect manually
        this.reconnectTimeout = setTimeout(() => {
          if (!this.isConnected && this.currentUserId) {
            this.connect(this.currentUserId);
          }
        }, this.reconnectDelay);
      }
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', (error) => {
    });

    this.socket.on('reconnect_failed', () => {
    });

    // Note-specific event listeners
    this.socket.on('joined_note', (data) => {
    });

    this.socket.on('left_note', (data) => {
    });

    this.socket.on('user_joined', (data) => {
    });

    this.socket.on('user_left', (data) => {
    });

    this.socket.on('error', (error) => {
    });

    this.socket.on('ping', () => {
    });

    this.socket.on('pong', (latency) => {
    });
  }

  disconnect() {
    if (this.socket) {
      
      // Clear any pending reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Leave all joined notes first
      this.joinedNotes.forEach(noteId => {
        this.leaveNote(noteId);
      });

      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.joinedNotes.clear();
      this.eventListeners.clear();
      this.currentUserId = null;
      this.reconnectAttempts = 0;
    }
  }

  joinNote(noteId) {
    if (!noteId) {
      return;
    }

    // OPTIMIZATION: Batch room operations to reduce WebSocket overhead
    this.pendingRoomOperations.add({ type: 'join', noteId });
    this._processPendingRoomOperations();
  }

  _processPendingRoomOperations() {
    // OPTIMIZATION: Debounce room operations to batch multiple joins/leaves
    if (this.roomOperationTimeout) {
      clearTimeout(this.roomOperationTimeout);
    }
    
    this.roomOperationTimeout = setTimeout(() => {
      if (!this.socket || !this.isConnected || !this.currentUserId) {
        return;
      }

      // Process all pending operations in batch
      const operations = Array.from(this.pendingRoomOperations);
      this.pendingRoomOperations.clear();

      operations.forEach(op => {
        if (op.type === 'join' && !this.joinedNotes.has(op.noteId)) {
          this.socket.emit('join_note', {
            note_id: op.noteId,
            user_id: this.currentUserId
          });
          this.joinedNotes.add(op.noteId);
        } else if (op.type === 'leave' && this.joinedNotes.has(op.noteId)) {
          this.socket.emit('leave_note', {
            note_id: op.noteId,
            user_id: this.currentUserId
          });
          this.joinedNotes.delete(op.noteId);
        }
      });
    }, 50); // 50ms debounce for room operations
  }

  leaveNote(noteId) {
    if (!noteId) {
      return;
    }
    
    // OPTIMIZATION: Batch room operations to reduce WebSocket overhead
    this.pendingRoomOperations.add({ type: 'leave', noteId });
    this._processPendingRoomOperations();
  }

  // OPTIMIZATION: Add event throttling
  _shouldThrottleEvent(eventKey) {
    const now = Date.now();
    const lastTime = this.lastEventTime.get(eventKey) || 0;
    
    if (now - lastTime < this.eventThrottleMs) {
      return true; // Should throttle
    }
    
    this.lastEventTime.set(eventKey, now);
    return false; // Don't throttle
  }

  // Emit events
  emitNoteUpdate(noteId, updateType, data) {
    if (!this.socket || !this.isConnected || !this.currentUserId) {
      return;
    }

    // OPTIMIZATION: Throttle note update events to prevent flooding
    const eventKey = `note_update_${noteId}_${updateType}`;
    if (this._shouldThrottleEvent(eventKey)) {
      return; // Skip this event due to throttling
    }

    this.socket.emit('note_updated', {
      note_id: noteId,
      user_id: this.currentUserId,
      update_type: updateType,
      data: data
    });
  }

  emitChecklistItemToggle(noteId, itemId, completed) {
    if (this.socket && this.isConnected && this.currentUserId) {
      this.socket.emit('checklist_item_toggled', {
        note_id: noteId,
        item_id: itemId,
        completed: completed,
        user_id: this.currentUserId
      });
    } else {
    }
  }

  emitNoteShared(noteId, sharedWithUserId, accessLevel) {
    if (this.socket && this.isConnected) {
      this.socket.emit('note_shared', {
        note_id: noteId,
        shared_with_user_id: sharedWithUserId,
        access_level: accessLevel
      });
    } else {
    }
  }

  emitNotesReordered(userId, noteIds) {
    if (this.socket && this.isConnected && this.currentUserId) {
      const payload = {
        user_id: userId,
        note_ids: noteIds
      };
      this.socket.emit('notes_reordered', payload);
    } else {
    }
  }

  // Event listeners for incoming events
  onNoteUpdate(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('note_update_received', callback);
      this.eventListeners.set('note_update_received', callback);
    } else {
    }
  }

  onChecklistItemToggle(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('checklist_item_toggle_received', callback);
      this.eventListeners.set('checklist_item_toggle_received', callback);
    } else {
    }
  }

  onNoteShared(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('note_share_received', callback);
      this.eventListeners.set('note_share_received', callback);
    } else {
    }
  }

  onNotesReordered(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }

    if (this.socket) {
      this.socket.on('notes_reorder_received', callback);
      this.eventListeners.set('notes_reorder_received', callback);
    } else {
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

  // Remove event listeners
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

  // Utility methods
  isSocketConnected() {
    return this.socket && this.socket.connected && this.isConnected;
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }

  getJoinedNotes() {
    return Array.from(this.joinedNotes);
  }

  // Utility methods
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      socketId: this.getSocketId(),
      currentUserId: this.currentUserId,
      joinedNotes: this.getJoinedNotes(),
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      eventListeners: Array.from(this.eventListeners.keys())
    };
  }

  // Test connection method
  testConnection() {
    if (this.socket && this.isConnected) {
      
      // Send a test ping
      this.socket.emit('ping', { timestamp: Date.now(), test: true });
      return true;
    } else {
      return false;
    }
  }

  // Force reconnection
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

  // Health check
  healthCheck() {
    const info = this.getConnectionInfo();
    const isHealthy = this.isSocketConnected() && this.currentUserId;
    
    return isHealthy;
  }
}

// Create and export a singleton instance
const socketClient = new WebSocketManager();


export default socketClient;

// Also export the class for testing or multiple instances
export { WebSocketManager };
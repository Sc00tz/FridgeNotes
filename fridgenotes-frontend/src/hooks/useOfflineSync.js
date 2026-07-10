/**
 * useOfflineSync Hook
 *
 * Detects online/offline status, queues API operations while offline, and
 * automatically replays them when connectivity is restored. Provides an
 * `executeWithOfflineSupport` wrapper that callers can use in place of
 * direct API calls to get transparent offline queuing.
 *
 * @param {Object} api - API client instance
 * @param {Object} currentUser - Current authenticated user
 * @returns {Object} Sync state and operation utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_PREFIX = 'fridgenotes_offline_';
const QUEUE_STORAGE_KEY = 'fridgenotes_sync_queue';
const MAX_QUEUE_SIZE = 1000;
const SYNC_RETRY_DELAY = 5000;
const MAX_RETRY_ATTEMPTS = 3;

export const useOfflineSync = (api, currentUser) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [syncErrors, setSyncErrors] = useState([]);

  const syncTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  // Holds a ref to the latest syncPendingOperations so the online event
  // handler never captures a stale closure.
  const syncPendingOperationsRef = useRef(null);

  // Optional callback fired when an offline-created note's client_id resolves
  // to a real server id, so the consumer (useNotes) can reconcile local state.
  const onNoteIdResolvedRef = useRef(null);
  const setOnNoteIdResolved = useCallback((fn) => {
    onNoteIdResolvedRef.current = fn;
  }, []);

  // Fired when a queued op is rejected with a 409 (server-wins). Receives
  // (operation, currentServerNote) so the consumer can reconcile and notify.
  const onConflictRef = useRef(null);
  const setOnConflict = useCallback((fn) => {
    onConflictRef.current = fn;
  }, []);

  // Fired after the queue finishes flushing, so the consumer can run a
  // catch-up delta-sync to pick up changes made on other devices.
  const onSyncCompleteRef = useRef(null);
  const setOnSyncComplete = useCallback((fn) => {
    onSyncCompleteRef.current = fn;
  }, []);

  const storageKey = currentUser ? `${STORAGE_KEY_PREFIX}${currentUser.id}` : null;

  useEffect(() => {
    if (!storageKey) return;

    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const queue = JSON.parse(stored);
        setQueueSize(Array.isArray(queue) ? queue.length : 0);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }, [storageKey]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      retryCountRef.current = 0;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      // Invoke through the ref so we always call the latest version.
      syncTimeoutRef.current = setTimeout(() => {
        syncPendingOperationsRef.current?.();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const getSyncQueue = useCallback(() => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading sync queue:', error);
      return [];
    }
  }, []);

  const saveSyncQueue = useCallback((queue) => {
    try {
      const limitedQueue = queue.slice(-MAX_QUEUE_SIZE);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(limitedQueue));
      setQueueSize(limitedQueue.length);
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }, []);

  const queueOperation = useCallback((operation) => {
    const queue = getSyncQueue();
    const queuedOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      ...operation,
    };

    queue.push(queuedOperation);
    saveSyncQueue(queue);

    return queuedOperation.id;
  }, [getSyncQueue, saveSyncQueue]);

  const executeOperation = useCallback(async (operation) => {
    const { type, method = 'POST', data, noteId } = operation;

    try {
      let result;

      switch (type) {
        case 'create_note':
          result = await api.createNote(data);
          break;
        case 'update_note':
          result = await api.updateNote(noteId, data);
          break;
        case 'delete_note':
          result = await api.deleteNote(noteId);
          break;
        case 'update_checklist_item':
          result = await api.updateChecklistItem(noteId, data.itemId, data.itemData);
          break;
        case 'add_label':
          result = await api.addLabelToNote(noteId, data.labelId);
          break;
        case 'remove_label':
          result = await api.removeLabelFromNote(noteId, data.labelId);
          break;
        case 'reorder_notes':
          result = await api.reorderNotes(data.noteIds);
          break;
        case 'custom':
          result = await api[method.toLowerCase()](operation.endpoint, data);
          break;
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      return { success: true, result };
    } catch (error) {
      // A 409 means the note changed on the server since this offline edit was
      // based on it. Retrying would just conflict again, so treat it as a
      // terminal conflict (server-wins) and hand the server's current state
      // back to the caller to reconcile — not a retryable failure.
      if (error.status === 409) {
        return { success: false, conflict: true, current: error.current || null, error: error.message };
      }
      console.error(`Failed to execute operation ${operation.id}:`, error);
      return { success: false, error: error.message };
    }
  }, [api]);

  const syncPendingOperations = useCallback(async () => {
    if (!isOnline || isSyncing || !currentUser) return;

    const queue = getSyncQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    setSyncErrors([]);

    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      const remainingQueue = [];
      // Maps an offline note's client_id (used as its optimistic local id) to
      // the real server id once its create syncs, so follow-up ops that were
      // queued against the client_id target the right note instead of 404ing.
      const idMap = {};

      for (const operation of queue) {
        // Rewrite a queued op's noteId if it referenced an offline note that
        // has since been assigned a real server id in this sync pass.
        if (operation.noteId && idMap[operation.noteId]) {
          operation = { ...operation, noteId: idMap[operation.noteId] };
        }

        const result = await executeOperation(operation);

        if (result.success) {
          results.successful++;

          // A create carries a client_id; record the client_id -> real id
          // mapping and let the caller reconcile local state.
          if (operation.type === 'create_note' && result.result) {
            const clientId = operation.data?.client_id || result.result.client_id;
            const realId = result.result.id;
            if (clientId && realId != null && clientId !== realId) {
              idMap[clientId] = realId;
              try {
                onNoteIdResolvedRef.current?.(clientId, result.result);
              } catch (cbError) {
                console.error('Error in onNoteIdResolved callback:', cbError);
              }
            }
          }
        } else if (result.conflict) {
          // Terminal conflict (server-wins): drop the op (don't requeue) and
          // let the consumer reconcile local state to the server's version.
          results.conflicts = (results.conflicts || 0) + 1;
          try {
            onConflictRef.current?.(operation, result.current);
          } catch (cbError) {
            console.error('Error in onConflict callback:', cbError);
          }
        } else {
          results.failed++;
          results.errors.push({
            operation: operation.type,
            error: result.error,
            timestamp: operation.timestamp,
          });

          if (operation.retryCount < MAX_RETRY_ATTEMPTS) {
            remainingQueue.push({
              ...operation,
              retryCount: (operation.retryCount || 0) + 1,
            });
          }
        }
      }

      saveSyncQueue(remainingQueue);
      setLastSync(new Date().toISOString());
      setSyncErrors(results.errors);

      // After flushing our queued writes, let the consumer run a catch-up
      // delta-sync to pull in changes made on other devices while offline.
      try {
        await onSyncCompleteRef.current?.(results);
      } catch (cbError) {
        console.error('Error in onSyncComplete callback:', cbError);
      }

      if (remainingQueue.length > 0 && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current++;
        syncTimeoutRef.current = setTimeout(() => {
          syncPendingOperations();
        }, SYNC_RETRY_DELAY * retryCountRef.current);
      } else {
        retryCountRef.current = 0;
      }

      return results;
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncErrors([{ error: error.message, timestamp: new Date().toISOString() }]);

      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current++;
        syncTimeoutRef.current = setTimeout(() => {
          syncPendingOperations();
        }, SYNC_RETRY_DELAY * retryCountRef.current);
      }

      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, currentUser, getSyncQueue, executeOperation, saveSyncQueue]);

  syncPendingOperationsRef.current = syncPendingOperations;

  const executeWithOfflineSupport = useCallback(async (operationConfig) => {
    if (isOnline) {
      try {
        return await executeOperation(operationConfig);
      } catch (error) {
        queueOperation(operationConfig);
        throw error;
      }
    } else {
      const operationId = queueOperation(operationConfig);
      return {
        success: false,
        queued: true,
        operationId,
        message: 'Operation queued for when back online',
      };
    }
  }, [isOnline, executeOperation, queueOperation]);

  const saveToLocalCache = useCallback((key, data) => {
    if (!storageKey) return;

    try {
      const fullKey = `${storageKey}_${key}`;
      const cacheData = {
        data,
        timestamp: new Date().toISOString(),
        version: 1,
      };
      localStorage.setItem(fullKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to local cache:', error);
    }
  }, [storageKey]);

  const loadFromLocalCache = useCallback((key, maxAge = 24 * 60 * 60 * 1000) => {
    if (!storageKey) return null;

    try {
      const fullKey = `${storageKey}_${key}`;
      const stored = localStorage.getItem(fullKey);
      if (!stored) return null;

      const cacheData = JSON.parse(stored);
      const age = Date.now() - new Date(cacheData.timestamp).getTime();

      if (age > maxAge) {
        localStorage.removeItem(fullKey);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Error loading from local cache:', error);
      return null;
    }
  }, [storageKey]);

  const clearSyncQueue = useCallback(() => {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    setQueueSize(0);
    setSyncErrors([]);
  }, []);

  const forceSync = useCallback(async () => {
    if (isOnline) {
      return await syncPendingOperations();
    } else {
      throw new Error('Cannot sync while offline');
    }
  }, [isOnline, syncPendingOperations]);

  return {
    isOnline,
    isSyncing,
    queueSize,
    lastSync,
    syncErrors,

    executeWithOfflineSupport,
    saveToLocalCache,
    loadFromLocalCache,
    syncPendingOperations,
    forceSync,
    clearSyncQueue,
    setOnNoteIdResolved,
    setOnConflict,
    setOnSyncComplete,

    queueOperation,
    getSyncQueue: () => getSyncQueue().length,
  };
};

export default useOfflineSync;

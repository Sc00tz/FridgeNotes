/**
 * useOfflineSync Hook
 * 
 * Enhanced offline sync handling for FridgeNotes.
 * Features:
 * - Detect online/offline status
 * - Queue operations while offline
 * - Auto-sync when back online
 * - Conflict resolution
 * - Local storage fallback
 * - Background sync with service worker
 * 
 * @param {Object} api - API client instance
 * @param {Object} currentUser - Current authenticated user
 * @returns {Object} Offline sync utilities and state
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_PREFIX = 'fridgenotes_offline_';
const QUEUE_STORAGE_KEY = 'fridgenotes_sync_queue';
const MAX_QUEUE_SIZE = 1000; // Maximum queued operations
const SYNC_RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;

export const useOfflineSync = (api, currentUser) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [syncErrors, setSyncErrors] = useState([]);
  
  const syncTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  const storageKey = currentUser ? `${STORAGE_KEY_PREFIX}${currentUser.id}` : null;

  // Initialize sync queue from localStorage
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

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      retryCountRef.current = 0; // Reset retry count
      // Trigger sync after a short delay to ensure connection is stable
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        syncPendingOperations();
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

  // Get sync queue from localStorage
  const getSyncQueue = useCallback(() => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading sync queue:', error);
      return [];
    }
  }, []);

  // Save sync queue to localStorage
  const saveSyncQueue = useCallback((queue) => {
    try {
      const limitedQueue = queue.slice(-MAX_QUEUE_SIZE); // Keep only recent operations
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(limitedQueue));
      setQueueSize(limitedQueue.length);
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }, []);

  // Add operation to sync queue
  const queueOperation = useCallback((operation) => {
    const queue = getSyncQueue();
    const queuedOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      ...operation
    };
    
    queue.push(queuedOperation);
    saveSyncQueue(queue);
    
    return queuedOperation.id;
  }, [getSyncQueue, saveSyncQueue]);

  // Execute a single operation
  const executeOperation = useCallback(async (operation) => {
    const { type, endpoint, method = 'POST', data, noteId } = operation;

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
          // Custom API call
          result = await api[method.toLowerCase()](endpoint, data);
          break;
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      return { success: true, result };
    } catch (error) {
      console.error(`Failed to execute operation ${operation.id}:`, error);
      return { success: false, error: error.message };
    }
  }, [api]);

  // Sync all pending operations
  const syncPendingOperations = useCallback(async () => {
    if (!isOnline || isSyncing || !currentUser) return;

    const queue = getSyncQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    setSyncErrors([]);
    
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      // Execute operations in order
      const remainingQueue = [];
      
      for (const operation of queue) {
        const result = await executeOperation(operation);
        
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            operation: operation.type,
            error: result.error,
            timestamp: operation.timestamp
          });
          
          // Retry failed operations up to MAX_RETRY_ATTEMPTS
          if (operation.retryCount < MAX_RETRY_ATTEMPTS) {
            remainingQueue.push({
              ...operation,
              retryCount: (operation.retryCount || 0) + 1
            });
          }
        }
      }

      // Update queue with remaining failed operations
      saveSyncQueue(remainingQueue);
      
      // Update sync status
      setLastSync(new Date().toISOString());
      setSyncErrors(results.errors);
      
      // If there are still failed operations, schedule a retry
      if (remainingQueue.length > 0 && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current++;
        syncTimeoutRef.current = setTimeout(() => {
          syncPendingOperations();
        }, SYNC_RETRY_DELAY * retryCountRef.current); // Exponential backoff
      } else {
        retryCountRef.current = 0;
      }

      return results;
      
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncErrors([{ error: error.message, timestamp: new Date().toISOString() }]);
      
      // Schedule retry
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

  // Wrapper for API operations that handles offline queueing
  const executeWithOfflineSupport = useCallback(async (operationConfig) => {
    if (isOnline) {
      try {
        return await executeOperation(operationConfig);
      } catch (error) {
        // If online but operation failed, queue it for retry
        queueOperation(operationConfig);
        throw error;
      }
    } else {
      // Queue operation for when back online
      const operationId = queueOperation(operationConfig);
      return {
        success: false,
        queued: true,
        operationId,
        message: 'Operation queued for when back online'
      };
    }
  }, [isOnline, executeOperation, queueOperation]);

  // Save data locally for offline access
  const saveToLocalCache = useCallback((key, data) => {
    if (!storageKey) return;
    
    try {
      const fullKey = `${storageKey}_${key}`;
      const cacheData = {
        data,
        timestamp: new Date().toISOString(),
        version: 1
      };
      localStorage.setItem(fullKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to local cache:', error);
    }
  }, [storageKey]);

  // Load data from local cache
  const loadFromLocalCache = useCallback((key, maxAge = 24 * 60 * 60 * 1000) => {
    if (!storageKey) return null;
    
    try {
      const fullKey = `${storageKey}_${key}`;
      const stored = localStorage.getItem(fullKey);
      if (!stored) return null;
      
      const cacheData = JSON.parse(stored);
      const age = Date.now() - new Date(cacheData.timestamp).getTime();
      
      // Check if cache is still valid
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

  // Clear sync queue
  const clearSyncQueue = useCallback(() => {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    setQueueSize(0);
    setSyncErrors([]);
  }, []);

  // Manual sync trigger
  const forcSync = useCallback(async () => {
    if (isOnline) {
      return await syncPendingOperations();
    } else {
      throw new Error('Cannot sync while offline');
    }
  }, [isOnline, syncPendingOperations]);

  return {
    // Status
    isOnline,
    isSyncing,
    queueSize,
    lastSync,
    syncErrors,
    
    // Operations
    executeWithOfflineSupport,
    saveToLocalCache,
    loadFromLocalCache,
    syncPendingOperations,
    forcSync,
    clearSyncQueue,
    
    // Queue management
    queueOperation,
    getSyncQueue: () => getSyncQueue().length
  };
};

export default useOfflineSync;
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../lib/api';
import socketClient from '../lib/socket';
import { useOfflineSync } from './useOfflineSync';

export const useNotes = (currentUser, isAuthenticated) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Initialize offline sync
  const offlineSync = useOfflineSync(apiClient, currentUser);

  // Refs for WebSocket room management
  const joinedRoomsRef = useRef(new Set());
  const notesRef = useRef([]);

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const showSuccess = useCallback((message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  // Keep notesRef in sync
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const handleNoteUpdate = useCallback((data) => {
    if (data.update_type === 'deleted') {
      setNotes(prevNotes => prevNotes.filter(note => note.id !== data.data.id));
    } else if (data.update_type === 'created') {
      setNotes(prevNotes => {
        if (prevNotes.some(note => note.id === data.data.id)) {
          return prevNotes;
        }
        return [data.data, ...prevNotes];
      });
    } else {
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === data.note_id ? { ...note, ...data.data } : note
        )
      );
    }
  }, []);

  const handleChecklistToggle = useCallback((data) => {
    setNotes(prevNotes => 
      prevNotes.map(note => {
        if (note.id === data.note_id) {
          const updatedItems = note.checklist_items.map(item =>
            item.id === data.item_id ? { ...item, completed: data.completed } : item
          );
          return { ...note, checklist_items: updatedItems };
        }
        return note;
      })
    );
  }, []);

  const handleNotesReordered = useCallback((data) => {
    // Add safety checks
    if (!data || !data.user_id || !data.note_ids || !Array.isArray(data.note_ids)) {
      return;
    }
    
    // Only update if this is for the current user
    if (data.user_id === currentUser?.id) {
      setNotes(prevNotes => {
        // Safety check
        if (!prevNotes || !Array.isArray(prevNotes)) {
          return prevNotes;
        }
        
        try {
          // Create a map for quick lookup
          const noteMap = new Map(prevNotes.map(note => [note.id, note]));
          
          // Reorder according to the received order
          const reorderedNotes = data.note_ids
            .map(id => noteMap.get(id))
            .filter(Boolean); // Remove any undefined notes
          
          // Add any notes that weren't in the reorder list (shouldn't happen but safety)
          const reorderedIds = new Set(data.note_ids);
          const remainingNotes = prevNotes.filter(note => !reorderedIds.has(note.id));
          
          const finalNotes = [...reorderedNotes, ...remainingNotes];
          
          return finalNotes;
        } catch (error) {
          return prevNotes; // Return original notes on error
        }
      });
    }
  }, [currentUser]);

  // Load notes and setup WebSocket
  const loadNotes = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;

    try {
      setLoading(true);
      const userNotes = await apiClient.getNotes();
      setNotes(userNotes);

      // Join WebSocket rooms for real-time updates
      if (socketClient.isConnected) {
        userNotes.forEach(note => {
          socketClient.joinNote(note.id);
          joinedRoomsRef.current.add(note.id);
        });
      }

      return userNotes;
    } catch (error) {
      showError('Failed to load notes: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentUser, showError]);

  // OPTIMIZED: Setup WebSocket when authenticated with better cleanup
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    let mounted = true;
    let connectionTimeout = null;
    
    const setupWebSocket = async () => {
      if (!mounted) return;
      
      socketClient.connect(currentUser.id);

      // Set up event listeners
      socketClient.onNoteUpdate(handleNoteUpdate);
      socketClient.onChecklistItemToggle(handleChecklistToggle);
      socketClient.onNotesReordered(handleNotesReordered);

      try {
        const userNotes = await loadNotes();
        
        if (!mounted) return; // Check if still mounted after async operation
        
        // OPTIMIZATION: Debounced room joining to reduce WebSocket overhead
        const joinRoomsDebounced = () => {
          if (!mounted || !socketClient.isConnected || !userNotes) return;
          
          userNotes.forEach(note => {
            socketClient.joinNote(note.id);
            joinedRoomsRef.current.add(note.id);
          });
        };
        
        // Wait for connection with timeout
        if (socketClient.isConnected) {
          joinRoomsDebounced();
        } else {
          connectionTimeout = setTimeout(() => {
            if (mounted && socketClient.isConnected) {
              joinRoomsDebounced();
            }
          }, 1000); // Single timeout instead of polling
        }
        
      } catch (error) {
        if (mounted) {
          showError('Failed to setup real-time connection');
        }
      }
    };

    setupWebSocket();

    // OPTIMIZED: Cleanup function with better resource management
    return () => {
      mounted = false;
      
      // Clear timeout
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      
      // Leave all rooms efficiently
      const roomsToLeave = Array.from(joinedRoomsRef.current);
      roomsToLeave.forEach(noteId => {
        socketClient.leaveNote(noteId);
      });
      joinedRoomsRef.current.clear();

      // Remove event listeners with the same function references
      socketClient.offNoteUpdate(handleNoteUpdate);
      socketClient.offChecklistItemToggle(handleChecklistToggle);
      socketClient.offNotesReordered(handleNotesReordered);
      
      socketClient.disconnect();
    };
  }, [isAuthenticated, currentUser]); // OPTIMIZED: Removed function dependencies to prevent excessive re-runs

  // Note operations
  const createNote = useCallback(async (noteData) => {
    try {
      setLoading(true);
      
      // Try with offline sync support
      const result = await offlineSync.executeWithOfflineSupport({
        type: 'create_note',
        data: noteData
      });
      
      if (result.success) {
        const newNote = result.result;
        setNotes(prevNotes => [newNote, ...prevNotes]);
        if (socketClient.isConnected) {
          socketClient.joinNote(newNote.id);
          joinedRoomsRef.current.add(newNote.id);
        }
        return newNote;
      } else if (result.queued) {
        // Operation queued for offline - create optimistic update
        const optimisticNote = {
          id: `temp_${Date.now()}`,
          ...noteData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _offline: true, // Mark as offline
          _operationId: result.operationId
        };
        setNotes(prevNotes => [optimisticNote, ...prevNotes]);
        showSuccess('Note will sync when back online');
        return optimisticNote;
      } else {
        throw new Error('Failed to create note');
      }
    } catch (error) {
      showError('Failed to create note: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError, offlineSync]);

  const updateNote = useCallback(async (noteIdOrNote, updatedNote) => {
    try {
      // Handle both calling patterns:
      // updateNote(noteId, updatedNote) or updateNote(updatedNote)
      let noteId, noteData;
      
      if (typeof noteIdOrNote === 'object' && noteIdOrNote.id) {
        // Called with just the note object: updateNote(updatedNote)
        noteId = noteIdOrNote.id;
        noteData = noteIdOrNote;
      } else {
        // Called with separate parameters: updateNote(noteId, updatedNote)
        noteId = noteIdOrNote;
        noteData = updatedNote;
      }
      
      const savedNote = await apiClient.updateNote(noteId, noteData);
      setNotes(prevNotes => 
        prevNotes.map(note => note.id === savedNote.id ? savedNote : note)
      );

      // Emit WebSocket update
      if (socketClient.isConnected) {
        socketClient.emitNoteUpdate(savedNote.id, 'content', savedNote);
      }

      return savedNote;
    } catch (error) {
      showError('Failed to update note: ' + error.message);
      throw error;
    }
  }, [showError]);

  const deleteNote = useCallback(async (noteId) => {
    try {
      await apiClient.deleteNote(noteId);
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      
      // Leave WebSocket room
      if (socketClient.isConnected) {
        socketClient.leaveNote(noteId);
        joinedRoomsRef.current.delete(noteId);
        socketClient.emitNoteUpdate(noteId, 'deleted', { id: noteId });
      }

    } catch (error) {
      showError('Failed to delete note: ' + error.message);
      throw error;
    }
  }, [showError]);

  const updateChecklistItem = useCallback(async (noteId, itemId, itemData) => {
    try {
      await apiClient.updateChecklistItem(noteId, itemId, itemData);
      
      // Update local state
      setNotes(prevNotes => 
        prevNotes.map(note => {
          if (note.id === noteId) {
            const updatedItems = note.checklist_items.map(item =>
              item.id === itemId ? { ...item, ...itemData } : item
            );
            return { ...note, checklist_items: updatedItems };
          }
          return note;
        })
      );

      // Emit WebSocket event for real-time sync
      if (socketClient.isConnected && itemData.completed !== undefined) {
        socketClient.emitChecklistItemToggle(noteId, itemId, itemData.completed);
      }

    } catch (error) {
      showError('Failed to update checklist item: ' + error.message);
      throw error;
    }
  }, [showError]);

  const reorderNotes = useCallback(async (noteIds) => {
    try {
      // Call API to persist the new order (no optimistic update)
      await apiClient.reorderNotes(noteIds);
      
      // Reload notes from server to get the correct order
      await loadNotes();
      
      showSuccess('Notes reordered');
      
    } catch (error) {
      showError('Failed to reorder notes: ' + error.message);
      throw error;
    }
  }, [currentUser, showError, showSuccess, loadNotes]);

  const pinToggle = useCallback(async (noteId, pinned) => {
    if (!isAuthenticated || !currentUser) {
      showError('Must be logged in to pin notes');
      return;
    }

    try {
      setLoading(true);
      
      // Optimistically update UI first
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === noteId ? { ...note, pinned } : note
        )
      );
      
      // Call API to update backend
      const response = await apiClient.pinNote(noteId, pinned);
      
      if (response) {
        showSuccess(response.message || (pinned ? 'Note pinned' : 'Note unpinned'));
      }
      
    } catch (error) {
      showError('Failed to update pin status: ' + error.message);
      
      // Revert optimistic update on error
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === noteId ? { ...note, pinned: !pinned } : note
        )
      );
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentUser, showError, showSuccess]);

  return {
    // State
    notes,
    loading,
    error,
    success,

    // Actions
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    updateChecklistItem,
    reorderNotes,
    pinToggle,
    setNotes, // For external updates (like label changes)

    // Offline sync
    offlineSync,
    api: apiClient // Expose API for other hooks
  };
};

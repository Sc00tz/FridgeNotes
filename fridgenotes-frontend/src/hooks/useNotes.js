/**
 * useNotes Hook
 *
 * Manages note state and all note CRUD operations, including real-time
 * WebSocket sync and offline-queue support via useOfflineSync.
 *
 * @param {Object} currentUser - Current authenticated user
 * @param {boolean} isAuthenticated - Authentication status
 * @returns {Object} Notes state, CRUD actions, offline sync utilities, and the API client
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../lib/api';
import socketClient from '../lib/socket';
import { useOfflineSync } from './useOfflineSync';

export const useNotes = (currentUser, isAuthenticated) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const offlineSync = useOfflineSync(apiClient, currentUser);

  // A ref is used for joined rooms so that the cleanup closure in the
  // WebSocket effect always sees the current set without needing it as
  // a dependency (which would cause the effect to re-run on every update).
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

  // Keep notesRef in sync with state so event handlers can read the latest
  // notes without being listed as effect dependencies.
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
    if (!data || !data.user_id || !data.note_ids || !Array.isArray(data.note_ids)) {
      return;
    }

    if (data.user_id === currentUser?.id) {
      setNotes(prevNotes => {
        if (!prevNotes || !Array.isArray(prevNotes)) {
          return prevNotes;
        }

        try {
          const noteMap = new Map(prevNotes.map(note => [note.id, note]));
          const reorderedNotes = data.note_ids
            .map(id => noteMap.get(id))
            .filter(Boolean);

          const reorderedIds = new Set(data.note_ids);
          const remainingNotes = prevNotes.filter(note => !reorderedIds.has(note.id));

          return [...reorderedNotes, ...remainingNotes];
        } catch (error) {
          return prevNotes;
        }
      });
    }
  }, [currentUser]);

  const loadNotes = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;

    try {
      setLoading(true);
      const userNotes = await apiClient.getNotes();
      setNotes(userNotes);
      return userNotes;
    } catch (error) {
      showError('Failed to load notes: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentUser, showError]);

  // Removed handler functions from the dependency array intentionally — they
  // are stable useCallback refs and including them would cause the socket to
  // reconnect on every render cycle.
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    let mounted = true;
    let connectionTimeout = null;

    const setupWebSocket = async () => {
      if (!mounted) return;

      socketClient.connect(currentUser.id);

      socketClient.onNoteUpdate(handleNoteUpdate);
      socketClient.onChecklistItemToggle(handleChecklistToggle);
      socketClient.onNotesReordered(handleNotesReordered);

      try {
        await loadNotes();
      } catch (error) {
        if (mounted) {
          showError('Failed to setup real-time connection');
        }
      }
    };

    setupWebSocket();

    return () => {
      mounted = false;

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }

      const roomsToLeave = Array.from(joinedRoomsRef.current);
      roomsToLeave.forEach(noteId => {
        socketClient.leaveNote(noteId);
      });
      joinedRoomsRef.current.clear();

      socketClient.offNoteUpdate(handleNoteUpdate);
      socketClient.offChecklistItemToggle(handleChecklistToggle);
      socketClient.offNotesReordered(handleNotesReordered);

      socketClient.disconnect();
    };
  }, [isAuthenticated, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const createNote = useCallback(async (noteData) => {
    try {
      setLoading(true);

      const result = await offlineSync.executeWithOfflineSupport({
        type: 'create_note',
        data: noteData,
      });

      if (result.success) {
        const newNote = result.result;
        // The backend also broadcasts a WS 'created' event to all users including
        // the creator, so the note may already be in state by the time this runs.
        setNotes(prevNotes => {
          if (prevNotes.some(n => n.id === newNote.id)) return prevNotes;
          return [newNote, ...prevNotes];
        });
        return newNote;
      } else if (result.queued) {
        const optimisticNote = {
          id: `temp_${Date.now()}`,
          ...noteData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _offline: true,
          _operationId: result.operationId,
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
  }, [showError, offlineSync, showSuccess]);

  const updateNote = useCallback(async (noteIdOrNote, updatedNote) => {
    try {
      // Supports both updateNote(noteId, data) and updateNote(noteObject)
      let noteId, noteData;

      if (typeof noteIdOrNote === 'object' && noteIdOrNote.id) {
        noteId = noteIdOrNote.id;
        noteData = noteIdOrNote;
      } else {
        noteId = noteIdOrNote;
        noteData = updatedNote;
      }

      const savedNote = await apiClient.updateNote(noteId, noteData);
      setNotes(prevNotes =>
        prevNotes.map(note => note.id === savedNote.id ? savedNote : note)
      );

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
      await apiClient.reorderNotes(noteIds);
      await loadNotes();
      showSuccess('Notes reordered');
    } catch (error) {
      showError('Failed to reorder notes: ' + error.message);
      throw error;
    }
  }, [showError, showSuccess, loadNotes]);

  const pinToggle = useCallback(async (noteId, pinned) => {
    if (!isAuthenticated || !currentUser) {
      showError('Must be logged in to pin notes');
      return;
    }

    try {
      setLoading(true);

      // Optimistic update applied before the API call to keep the UI responsive.
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === noteId ? { ...note, pinned } : note
        )
      );

      const response = await apiClient.pinNote(noteId, pinned);

      if (response) {
        showSuccess(response.message || (pinned ? 'Note pinned' : 'Note unpinned'));
      }
    } catch (error) {
      showError('Failed to update pin status: ' + error.message);

      // Revert the optimistic update on failure.
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
    notes,
    loading,
    error,
    success,

    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    updateChecklistItem,
    reorderNotes,
    pinToggle,
    setNotes,

    offlineSync,
    api: apiClient,
  };
};

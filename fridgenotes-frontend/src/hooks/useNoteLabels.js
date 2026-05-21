/**
 * useNoteLabels Hook
 *
 * Composite hook that merges useNotes and useLabels into a single interface.
 * Handles all operations that touch both domains (adding/removing labels on
 * notes, propagating label edits/deletes into note state) so that App.jsx
 * only needs to deal with UI orchestration.
 *
 * @param {Object} currentUser - Current authenticated user
 * @param {boolean} isAuthenticated - Authentication status
 * @returns {Object} Combined notes and labels state with relationship management
 */

import { useCallback } from 'react';
import { useNotes } from './useNotes';
import { useLabels } from './useLabels';

export const useNoteLabels = (currentUser, isAuthenticated) => {
  const notes = useNotes(currentUser, isAuthenticated);
  const labels = useLabels(isAuthenticated, currentUser);

  const addLabelToNote = useCallback(async (noteId, labelId) => {
    const numericNoteId = parseInt(noteId);
    const numericLabelId = parseInt(labelId);
    try {
      await labels.addLabelToNote(numericNoteId, numericLabelId);
      notes.setNotes(prevNotes => prevNotes.map(note => {
        if (parseInt(note.id) === numericNoteId) {
          const label = labels.labels.find(l => parseInt(l.id) === numericLabelId);
          if (label && !note.labels?.some(l => parseInt(l.id) === numericLabelId)) {
            return {
              ...note,
              labels: [...(note.labels || []), label],
            };
          }
        }
        return note;
      }));
    } catch (error) {
      throw error;
    }
  }, [labels, notes]);

  const removeLabelFromNote = useCallback(async (noteId, labelId) => {
    const numericNoteId = parseInt(noteId);
    const numericLabelId = parseInt(labelId);
    const originalNotes = notes.notes;
    try {
      // Optimistic removal applied before the API call for snappy UI.
      notes.setNotes(prevNotes => prevNotes.map(note => {
        if (parseInt(note.id) === numericNoteId) {
          const updatedLabels = (note.labels || []).filter(label => {
            return parseInt(label.id) !== numericLabelId;
          });
          return {
            ...note,
            labels: updatedLabels,
          };
        }
        return note;
      }));
      await labels.removeLabelFromNote(numericNoteId, numericLabelId);
    } catch (error) {
      if (
        error.message.includes('404') ||
        error.message.includes('not found') ||
        error.message.includes('Association not found') ||
        error.message.includes('Label was not associated')
      ) {
        // Association already gone — local state is already correct, swallow error.
      } else {
        notes.setNotes(originalNotes);
        throw error;
      }
    }
  }, [labels, notes]);

  const deleteLabel = useCallback(async (labelId) => {
    try {
      await labels.deleteLabel(labelId);
      notes.setNotes(prevNotes => prevNotes.map(note => ({
        ...note,
        labels: (note.labels || []).filter(label => label.id !== labelId),
      })));
    } catch (error) {
      throw error;
    }
  }, [labels, notes]);

  const createLabel = useCallback(async (labelData) => {
    return await labels.createLabel(labelData);
  }, [labels]);

  const updateLabel = useCallback(async (labelId, labelData) => {
    try {
      const updatedLabel = await labels.updateLabel(labelId, labelData);
      notes.setNotes(prevNotes => prevNotes.map(note => ({
        ...note,
        labels: (note.labels || []).map(label =>
          label.id === labelId ? updatedLabel : label
        ),
      })));
      return updatedLabel;
    } catch (error) {
      throw error;
    }
  }, [labels, notes]);

  const getNotesByLabel = useCallback((labelId) => {
    return notes.notes.filter(note =>
      note.labels?.some(label => label.id === labelId)
    );
  }, [notes.notes]);

  const getLabelUsageStats = useCallback(() => {
    const stats = {};
    labels.labels.forEach(label => {
      stats[label.id] = {
        ...label,
        noteCount: notes.notes.filter(note =>
          note.labels?.some(l => l.id === label.id)
        ).length,
      };
    });
    return Object.values(stats);
  }, [labels.labels, notes.notes]);

  return {
    notes: notes.notes,
    setNotes: notes.setNotes,
    createNote: notes.createNote,
    updateNote: notes.updateNote,
    deleteNote: notes.deleteNote,
    updateChecklistItem: notes.updateChecklistItem,
    reorderNotes: notes.reorderNotes,
    pinToggle: notes.pinToggle,
    fetchNotes: notes.loadNotes,
    api: notes.api,
    offlineSync: notes.offlineSync,

    labels: labels.labels,
    clearLabels: labels.clearLabels,
    searchLabels: labels.searchLabels,

    addLabelToNote,
    removeLabelFromNote,
    deleteLabel,
    createLabel,
    updateLabel,

    getNotesByLabel,
    getLabelUsageStats,

    loading: notes.loading || labels.loading,
    error: notes.error || labels.error,
    success: notes.success || labels.success,
  };
};

export default useNoteLabels;

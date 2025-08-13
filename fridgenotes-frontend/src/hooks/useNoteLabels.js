import { useCallback } from 'react';
import { useNotes } from './useNotes';
import { useLabels } from './useLabels';

/**
 * Composite hook that manages the relationship between notes and labels
 * 
 * This hook encapsulates all operations that involve both notes and labels,
 * keeping App.jsx focused purely on UI orchestration.
 * 
 * @param {Object} currentUser - Current authenticated user
 * @param {boolean} isAuthenticated - Authentication status
 * @returns {Object} Combined notes and labels state with relationship management
 */
export const useNoteLabels = (currentUser, isAuthenticated) => {
  // Use the individual hooks
  const notes = useNotes(currentUser, isAuthenticated);
  const labels = useLabels(isAuthenticated, currentUser);

  /**
   * Add a label to a note
   * Handles both the API call and updating local state
   */
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
              labels: [...(note.labels || []), label] 
            };
          }
        }
        return note;
      }));
    } catch (error) {
      throw error;
    }
  }, [labels, notes]);

  /**
   * Remove a label from a note
   * Handles both the API call and updating local state with proper error handling
   */
  const removeLabelFromNote = useCallback(async (noteId, labelId) => {
    const numericNoteId = parseInt(noteId);
    const numericLabelId = parseInt(labelId);
    const originalNotes = notes.notes;
    try {
      notes.setNotes(prevNotes => prevNotes.map(note => {
        if (parseInt(note.id) === numericNoteId) {
          const updatedLabels = (note.labels || []).filter(label => {
            return parseInt(label.id) !== numericLabelId;
          });
          return {
            ...note, 
            labels: updatedLabels
          };
        }
        return note;
      }));
      await labels.removeLabelFromNote(numericNoteId, numericLabelId);
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('Association not found')) {
      } else if (error.message.includes('Label was not associated')) {
      } else {
        notes.setNotes(originalNotes);
        throw error;
      }
    }
  }, [labels, notes]);

  /**
   * Delete a label entirely
   * Removes the label from all notes and deletes it from the labels list
   */
  const deleteLabel = useCallback(async (labelId) => {
    try {
      // Delete the label via API (this should also remove all note associations)
      await labels.deleteLabel(labelId);
      
      // Update local notes state to remove the label from all notes
      notes.setNotes(prevNotes => prevNotes.map(note => ({
        ...note,
        labels: (note.labels || []).filter(label => label.id !== labelId)
      })));
      
    } catch (error) {
      throw error;
    }
  }, [labels, notes]);

  /**
   * Create a new label
   * Delegates to the labels hook since this doesn't affect notes
   */
  const createLabel = useCallback(async (labelData) => {
    return await labels.createLabel(labelData);
  }, [labels]);

  /**
   * Update an existing label
   * Updates the label and refreshes notes that use this label
   */
  const updateLabel = useCallback(async (labelId, labelData) => {
    try {
      const updatedLabel = await labels.updateLabel(labelId, labelData);
      
      // Update the label in all notes that use it
      notes.setNotes(prevNotes => prevNotes.map(note => ({
        ...note,
        labels: (note.labels || []).map(label => 
          label.id === labelId ? updatedLabel : label
        )
      })));
      
      return updatedLabel;
      
    } catch (error) {
      throw error;
    }
  }, [labels, notes]);

  /**
   * Get notes filtered by a specific label
   */
  const getNotesByLabel = useCallback((labelId) => {
    return notes.notes.filter(note => 
      note.labels?.some(label => label.id === labelId)
    );
  }, [notes.notes]);

  /**
   * Get usage statistics for labels
   */
  const getLabelUsageStats = useCallback(() => {
    const stats = {};
    
    labels.labels.forEach(label => {
      stats[label.id] = {
        ...label,
        noteCount: notes.notes.filter(note => 
          note.labels?.some(l => l.id === label.id)
        ).length
      };
    });
    
    return Object.values(stats);
  }, [labels.labels, notes.notes]);

  // Return combined interface
  return {
    // Notes state and operations
    notes: notes.notes,
    setNotes: notes.setNotes,
    createNote: notes.createNote,
    updateNote: notes.updateNote,
    deleteNote: notes.deleteNote,
    updateChecklistItem: notes.updateChecklistItem,
    reorderNotes: notes.reorderNotes,
    pinToggle: notes.pinToggle,
    
    // Labels state and operations
    labels: labels.labels,
    clearLabels: labels.clearLabels,
    searchLabels: labels.searchLabels,
    
    // Combined operations (the main value of this hook)
    addLabelToNote,
    removeLabelFromNote,
    deleteLabel,
    createLabel,
    updateLabel,
    
    // Utility functions
    getNotesByLabel,
    getLabelUsageStats,
    
    // Loading and error states
    loading: notes.loading || labels.loading,
    error: notes.error || labels.error,
    success: notes.success || labels.success,
  };
};

export default useNoteLabels;

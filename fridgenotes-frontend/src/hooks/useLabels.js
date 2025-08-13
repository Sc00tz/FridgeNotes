import { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/api';

export const useLabels = (isAuthenticated, currentUser) => {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load labels for the current user
  const loadLabels = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;
    try {
      setLoading(true);
      setError(null);
      const userLabels = await apiClient.getLabels();
      setLabels(userLabels);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentUser]);

  // Load labels when user is authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadLabels();
    }
  }, [isAuthenticated, currentUser, loadLabels]);

  // Clear labels on logout
  const clearLabels = useCallback(() => {
    setLabels([]);
    setError(null);
  }, []);

  // Create a new label
  const createLabel = useCallback(async (labelData) => {
    try {
      setLoading(true);
      setError(null);
      const newLabel = await apiClient.createLabel(labelData);
      setLabels(prevLabels => [newLabel, ...prevLabels]);
      return newLabel;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update an existing label
  const updateLabel = useCallback(async (labelId, labelData) => {
    try {
      setLoading(true);
      setError(null);
      const updatedLabel = await apiClient.updateLabel(labelId, labelData);
      setLabels(prevLabels => 
        prevLabels.map(label => label.id === labelId ? updatedLabel : label)
      );
      return updatedLabel;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a label
  const deleteLabel = useCallback(async (labelId) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.deleteLabel(labelId);
      setLabels(prevLabels => prevLabels.filter(label => label.id !== labelId));
      return labelId;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Add label to note
  const addLabelToNote = useCallback(async (noteId, labelId) => {
    try {
      const numericNoteId = parseInt(noteId);
      const numericLabelId = parseInt(labelId);
      await apiClient.addLabelToNote(numericNoteId, numericLabelId);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  // Remove label from note
  const removeLabelFromNote = useCallback(async (noteId, labelId) => {
    try {
      const numericNoteId = parseInt(noteId);
      const numericLabelId = parseInt(labelId);
      await apiClient.removeLabelFromNote(numericNoteId, numericLabelId);
    } catch (error) {
      if (error.message.includes('Internal server error')) {
        const errorMsg = 'Server error removing label. This might be a temporary issue - please try again later.';
        setError(errorMsg);
        throw new Error(errorMsg);
      } else if (error.message.includes('not found') || error.message.includes('Label') && error.message.includes('not found')) {
        const errorMsg = 'Label or note not found. It may have already been removed.';
        setError(errorMsg);
        throw new Error(errorMsg);
      } else if (error.message.includes('Label was not associated')) {
        return;
      } else if (error.message.includes('Association not found')) {
        return;
      } else {
        const errorMsg = `Failed to remove label: ${error.message}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }, []);

  // Search labels
  const searchLabels = useCallback(async (query) => {
    try {
      if (!query || !query.trim()) return [];
      return await apiClient.searchLabels(query);
    } catch (error) {
      setError(error.message);
      return [];
    }
  }, []);

  return {
    labels,
    loading,
    error,
    loadLabels,
    clearLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    addLabelToNote,
    removeLabelFromNote,
    searchLabels
  };
};

export default useLabels;

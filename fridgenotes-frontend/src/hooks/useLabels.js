/**
 * useLabels Hook
 *
 * Manages label CRUD and the note-label association API calls. Note state
 * updates that result from label changes (e.g. removing a label from all
 * notes) are handled one level up in useNoteLabels.
 *
 * @param {boolean} isAuthenticated - Authentication status
 * @param {Object} currentUser - Current authenticated user
 * @returns {Object} Labels state and management actions
 */

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/api';

export const useLabels = (isAuthenticated, currentUser) => {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadLabels();
    }
  }, [isAuthenticated, currentUser, loadLabels]);

  const clearLabels = useCallback(() => {
    setLabels([]);
    setError(null);
  }, []);

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
      } else if (
        error.message.includes('not found') ||
        (error.message.includes('Label') && error.message.includes('not found'))
      ) {
        const errorMsg = 'Label or note not found. It may have already been removed.';
        setError(errorMsg);
        throw new Error(errorMsg);
      } else if (
        error.message.includes('Label was not associated') ||
        error.message.includes('Association not found')
      ) {
        // Association already gone — treat as success.
        return;
      } else {
        const errorMsg = `Failed to remove label: ${error.message}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }, []);

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
    searchLabels,
  };
};

export default useLabels;

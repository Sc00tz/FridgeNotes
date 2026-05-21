/**
 * useShare Hook
 *
 * Manages note sharing operations (share with another user, hide a shared
 * note from the current user's view). Emits WebSocket events so the
 * recipient sees the share in real time.
 *
 * @returns {Object} { loading, error, success, shareNote, hideSharedNote, showError, showSuccess }
 */

import { useState, useCallback } from 'react';
import apiClient from '../lib/api';
import socketClient from '../lib/socket';

export const useShare = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const showSuccess = useCallback((message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  const shareNote = useCallback(async (noteId, shareData) => {
    try {
      setLoading(true);
      setError(null);

      await apiClient.shareNote(noteId, shareData);

      if (socketClient.isConnected) {
        socketClient.emitNoteShared(noteId, shareData.username, shareData.access_level);
      }

      showSuccess(`Note shared with ${shareData.username}!`);
    } catch (error) {
      showError('Failed to share note: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError, showSuccess]);

  const hideSharedNote = useCallback(async (noteId, shareId) => {
    try {
      setLoading(true);
      setError(null);

      await apiClient.hideSharedNote(noteId, shareId);

      showSuccess('Note hidden from your view');
      return true;
    } catch (error) {
      showError('Failed to hide note: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError, showSuccess]);

  return {
    loading,
    error,
    success,
    shareNote,
    hideSharedNote,
    showError,
    showSuccess,
  };
};

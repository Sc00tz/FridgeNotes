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

      // Emit WebSocket event for real-time notification
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
      return true; // Indicate success for state updates
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
    showError,    // ✅ Add this
    showSuccess   // ✅ Add this
  };
};

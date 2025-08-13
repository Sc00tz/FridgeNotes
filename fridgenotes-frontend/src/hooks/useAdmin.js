import { useState, useCallback, useEffect } from 'react';
import authAPI from '../lib/auth';

export const useAdmin = (currentUser) => {
  const [users, setUsers] = useState([]);
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

  const loadUsers = useCallback(async () => {
    if (!currentUser?.is_admin) return;

    try {
      setLoading(true);
      const response = await authAPI.getAllUsers();
      setUsers(response.users || []);
    } catch (error) {
      showError('Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.is_admin, showError]);

  // Load users when user becomes admin
  useEffect(() => {
    if (currentUser?.is_admin) {
      loadUsers();
    }
  }, [currentUser?.is_admin, loadUsers]);

  const createUser = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      await authAPI.createUser(userData);
      await loadUsers(); // Reload users list
      showSuccess('User created successfully!');
    } catch (error) {
      showError(authAPI.handleAuthError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadUsers, showError, showSuccess]);

  const updateUser = useCallback(async (userId, userData) => {
    try {
      setLoading(true);
      setError(null);
      
      await authAPI.updateUser(userId, userData);
      await loadUsers(); // Reload users list
      showSuccess('User updated successfully!');
    } catch (error) {
      showError(authAPI.handleAuthError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadUsers, showError, showSuccess]);

  const deleteUser = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);
      
      await authAPI.deleteUser(userId);
      await loadUsers(); // Reload users list
      showSuccess('User deleted successfully!');
    } catch (error) {
      showError(authAPI.handleAuthError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadUsers, showError, showSuccess]);

  const toggleUserActive = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);
      
      await authAPI.toggleUserActive(userId);
      await loadUsers(); // Reload users list
      showSuccess('User status updated successfully!');
    } catch (error) {
      showError(authAPI.handleAuthError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadUsers, showError, showSuccess]);

  const toggleUserAdmin = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);
      
      await authAPI.toggleUserAdmin(userId);
      await loadUsers(); // Reload users list
      showSuccess('User admin status updated successfully!');
    } catch (error) {
      showError(authAPI.handleAuthError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadUsers, showError, showSuccess]);

  return {
    // State
    users,
    loading,
    error,
    success,

    // Actions
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserActive,
    toggleUserAdmin
  };
};

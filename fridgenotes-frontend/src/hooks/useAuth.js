import { useState, useCallback } from 'react';
import authAPI from '../lib/auth';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const showSuccess = useCallback((message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const authStatus = await authAPI.checkAuthStatus();
      
      if (authStatus.authenticated) {
        setCurrentUser(authStatus.user);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      
      return authStatus;
    } catch (error) {
      setIsAuthenticated(false);
      setCurrentUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (loginData) => {
    try {
      setLoading(true);
      clearMessages();
      
      const response = await authAPI.login(loginData);
      setCurrentUser(response.user);
      setIsAuthenticated(true);
      showSuccess('Login successful!');
      
      return response;
    } catch (error) {
      const errorMessage = authAPI.handleAuthError(error);
      showError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearMessages, showError, showSuccess]);

  const register = useCallback(async (registerData) => {
    try {
      setLoading(true);
      clearMessages();
      
      const response = await authAPI.register(registerData);
      setCurrentUser(response.user);
      setIsAuthenticated(true);
      showSuccess('Account created successfully!');
      
      return response;
    } catch (error) {
      const errorMessage = authAPI.handleAuthError(error);
      showError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearMessages, showError, showSuccess]);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
      setCurrentUser(null);
      setIsAuthenticated(false);
      showSuccess('Logged out successfully!');
    } catch (error) {
      showError('Failed to logout');
      throw error;
    }
  }, [showError, showSuccess]);

  const updateProfile = useCallback(async (profileData) => {
    try {
      setLoading(true);
      clearMessages();
      
      const updatedUser = await authAPI.updateProfile(profileData);
      setCurrentUser(updatedUser);
      showSuccess('Profile updated successfully!');
      
      return updatedUser;
    } catch (error) {
      const errorMessage = authAPI.handleAuthError(error);
      showError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearMessages, showError, showSuccess]);

  const changePassword = useCallback(async (passwordData) => {
    try {
      setLoading(true);
      clearMessages();
      
      await authAPI.changePassword(passwordData);
      showSuccess('Password changed successfully!');
    } catch (error) {
      const errorMessage = authAPI.handleAuthError(error);
      showError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearMessages, showError, showSuccess]);

  return {
    // State
    currentUser,
    isAuthenticated,
    loading,
    error,
    success,

    // Actions
    checkAuthStatus,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    clearMessages,
    showError,
    showSuccess,
    setCurrentUser, // For external updates
    setIsAuthenticated // For external updates
  };
};

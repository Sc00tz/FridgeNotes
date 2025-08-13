const API_BASE_URL = '/api';

class AuthAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for session management
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Authentication endpoints
  async login({ username, email, password, remember = false }) {
    const loginData = {
      password,
      remember,
      ...(username ? { username } : { email })
    };

    return this.makeRequest('/auth/login', {
      method: 'POST',
      body: loginData,
    });
  }

  async register({ username, email, password }) {
    return this.makeRequest('/auth/register', {
      method: 'POST',
      body: { username, email, password },
    });
  }

  async logout() {
    return this.makeRequest('/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.makeRequest('/auth/me');
  }

  async checkAuthStatus() {
    return this.makeRequest('/auth/check');
  }

  async changePassword({ current_password, new_password }) {
    return this.makeRequest('/auth/change-password', {
      method: 'POST',
      body: { current_password, new_password },
    });
  }

  async forgotPassword({ email }) {
    return this.makeRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  }

  // User management endpoints
  async updateProfile({ username, email, password }) {
    const profileData = { username, email };
    if (password) {
      profileData.password = password;
    }

    return this.makeRequest('/users/me', {
      method: 'PUT',
      body: profileData,
    });
  }

  async getProfile() {
    return this.makeRequest('/users/me');
  }

  // Admin endpoints
  async getAllUsers() {
    return this.makeRequest('/auth/admin/users');
  }

  async createUser({ username, email, password, is_admin = false }) {
    return this.makeRequest('/users', {
      method: 'POST',
      body: { username, email, password, is_admin },
    });
  }

  async updateUser(userId, userData) {
    return this.makeRequest(`/users/${userId}`, {
      method: 'PUT',
      body: userData,
    });
  }

  async deleteUser(userId) {
    return this.makeRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async toggleUserActive(userId) {
    return this.makeRequest(`/auth/admin/users/${userId}/toggle-active`, {
      method: 'POST',
    });
  }

  async toggleUserAdmin(userId) {
    return this.makeRequest(`/auth/admin/users/${userId}/toggle-admin`, {
      method: 'POST',
    });
  }

  // Helper methods
  isLoggedIn() {
    // This will be determined by the auth check endpoint
    // Could also check for stored auth state
    return this.checkAuthStatus()
      .then(response => response.authenticated)
      .catch(() => false);
  }

  async getStoredUser() {
    try {
      const response = await this.checkAuthStatus();
      return response.authenticated ? response.user : null;
    } catch (error) {
      return null;
    }
  }

  // Session management helpers
  async refreshSession() {
    try {
      return await this.getCurrentUser();
    } catch (error) {
      // Session expired or invalid
      return null;
    }
  }

  // Validation helpers
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validateUsername(username) {
    // Username: 3-30 characters, alphanumeric plus dots, hyphens, underscores
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
    return usernameRegex.test(username);
  }

  validatePassword(password) {
    // Password: minimum 6 characters
    return password && password.length >= 6;
  }

  // Error handling helper
  handleAuthError(error) {
    const message = error.message || 'An authentication error occurred';
    
    // Common error messages
    if (message.includes('Invalid credentials')) {
      return 'Invalid username/email or password';
    }
    if (message.includes('already exists')) {
      return 'An account with this username or email already exists';
    }
    if (message.includes('required')) {
      return 'Please fill in all required fields';
    }
    if (message.includes('disabled')) {
      return 'This account has been disabled';
    }
    
    return message;
  }
}

// Create and export a singleton instance
const authAPI = new AuthAPI();

export default authAPI;

// Also export the class for testing or multiple instances
export { AuthAPI };
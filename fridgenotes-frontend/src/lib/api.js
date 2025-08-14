/**
 * API Client for FridgeNotes
 * Handles all communication with the backend API
 */
const API_BASE_URL = '/api';

class APIClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.timeout = 30000; // 30 second timeout
  }

  /**
   * Make an HTTP request to the API
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} options - Request options
   * @returns {Promise} - Response data
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Merge default headers with custom headers
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    const config = {
      method: 'GET',
      headers,
      credentials: 'include', // Include cookies for session management
      ...options,
    };

    // Convert body to JSON string if it's an object
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    config.signal = controller.signal;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        await this.handleErrorResponse(response, endpoint);
      }

      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType && contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = { success: true };
      }
      
      return data;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout / 1000} seconds`);
      }
      
      throw error;
    }
  }

  /**
   * Handle error responses from the API
   * @param {Response} response - Fetch response object
   * @param {string} endpoint - Original endpoint
   */
  async handleErrorResponse(response, endpoint) {
    let errorData;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { message: await response.text() };
      }
    } catch (parseError) {
      errorData = { message: `HTTP ${response.status} ${response.statusText}` };
    }

    // Handle specific HTTP status codes
    switch (response.status) {
      case 400:
        throw new Error(errorData.error || errorData.message || 'Bad Request');
      case 401:
        throw new Error('Authentication required');
      case 403:
        throw new Error('Access denied');
      case 404:
        throw new Error(errorData.error || errorData.message || 'Resource not found');
      case 409:
        throw new Error(errorData.error || errorData.message || 'Conflict');
      case 422:
        throw new Error(errorData.error || errorData.message || 'Validation error');
      case 429:
        throw new Error('Too many requests. Please try again later.');
      case 500:
        throw new Error('Internal server error. Please try again.');
      case 502:
      case 503:
      case 504:
        throw new Error('Server temporarily unavailable. Please try again.');
      default:
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Hide or unhide a shared note for the current user
   * @param {number|string} noteId - Note ID
   * @param {number|string} shareId - Share record ID
   * @param {boolean} hidden - Whether to hide (true) or unhide (false) the note
   * @returns {Promise<Object>} Updated share status
   */
  async toggleSharedNoteVisibility(noteId, shareId, hidden) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!shareId) {
      throw new Error('Share ID is required');
    }

    return this.makeRequest(`/notes/${noteId}/shares/${shareId}/hide`, {
      method: 'PUT',
      body: { hidden },
    });
  }

  /**
   * Hide a shared note from the current user's view
   * @param {number|string} noteId - Note ID
   * @param {number|string} shareId - Share record ID
   * @returns {Promise<Object>} Updated share status
   */
  async hideSharedNote(noteId, shareId) {
    return this.toggleSharedNoteVisibility(noteId, shareId, true);
  }

  /**
   * Unhide a shared note for the current user
   * @param {number|string} noteId - Note ID
   * @param {number|string} shareId - Share record ID
   * @returns {Promise<Object>} Updated share status
   */
  async unhideSharedNote(noteId, shareId) {
    return this.toggleSharedNoteVisibility(noteId, shareId, false);
  }

  // ===================
  // Note Management
  // ===================

  /**
   * Get all notes for the authenticated user
   * @returns {Promise<Array>} Array of notes
   */
  async getNotes() {
    return this.makeRequest('/notes');
  }

  /**
   * Get a specific note by ID
   * @param {number|string} noteId - Note ID
   * @returns {Promise<Object>} Note object
   */
  async getNote(noteId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }
    return this.makeRequest(`/notes/${noteId}`);
  }

  /**
   * Create a new note
   * @param {Object} noteData - Note data
   * @param {string} noteData.title - Note title
   * @param {string} noteData.content - Note content (for text notes)
   * @param {string} noteData.note_type - Note type ('text' or 'checklist')
   * @param {Array} noteData.checklist_items - Checklist items (for checklist notes)
   * @returns {Promise<Object>} Created note
   */
  async createNote(noteData) {
    if (!noteData || typeof noteData !== 'object') {
      throw new Error('Note data is required');
    }

    // Validate required fields
    if (!noteData.note_type) {
      throw new Error('Note type is required');
    }

    if (!['text', 'checklist'].includes(noteData.note_type)) {
      throw new Error('Note type must be "text" or "checklist"');
    }

    return this.makeRequest('/notes', {
      method: 'POST',
      body: noteData,
    });
  }

  /**
   * Update an existing note
   * @param {number|string} noteId - Note ID
   * @param {Object} noteData - Updated note data
   * @returns {Promise<Object>} Updated note
   */
  async updateNote(noteId, noteData) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!noteData || typeof noteData !== 'object') {
      throw new Error('Note data is required');
    }

    return this.makeRequest(`/notes/${noteId}`, {
      method: 'PUT',
      body: noteData,
    });
  }

  /**
   * Delete a note
   * @param {number|string} noteId - Note ID
   * @returns {Promise<Object>} Success response
   */
  async deleteNote(noteId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    return this.makeRequest(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Archive or unarchive a note
   * @param {number|string} noteId - Note ID
   * @param {boolean} archived - Archive status
   * @returns {Promise<Object>} Updated note
   */
  async archiveNote(noteId, archived = true) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    return this.updateNote(noteId, { archived });
  }

  /**
   * Pin or unpin a note
   * @param {number|string} noteId - Note ID
   * @param {boolean} pinned - Pin status
   * @returns {Promise<Object>} Updated pin status
   */
  async pinNote(noteId, pinned) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (typeof pinned !== 'boolean') {
      throw new Error('Pinned status must be a boolean');
    }

    return this.makeRequest(`/notes/${noteId}/pin`, {
      method: 'PUT',
      body: { pinned },
    });
  }

  /**
   * Mark a note's reminder as completed
   * @param {number|string} noteId - Note ID
   * @returns {Promise<Object>} Completion response
   */
  async completeReminder(noteId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    return this.makeRequest(`/notes/${noteId}/reminder/complete`, {
      method: 'POST',
    });
  }

  /**
   * Snooze a note's reminder until a specified time
   * @param {number|string} noteId - Note ID
   * @param {string} snoozeUntil - ISO datetime string for when to show reminder again
   * @returns {Promise<Object>} Snooze response
   */
  async snoozeReminder(noteId, snoozeUntil) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!snoozeUntil) {
      throw new Error('Snooze until time is required');
    }

    return this.makeRequest(`/notes/${noteId}/reminder/snooze`, {
      method: 'POST',
      body: { snooze_until: snoozeUntil },
    });
  }

  /**
   * Dismiss a reminder notification without completing it
   * @param {number|string} noteId - Note ID
   * @returns {Promise<Object>} Dismiss response
   */
  async dismissReminder(noteId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    return this.makeRequest(`/notes/${noteId}/reminder/dismiss`, {
      method: 'POST',
    });
  }

  /**
   * Reorder notes for the current user
   * @param {Array<number>} noteIds - Array of note IDs in new order
   * @returns {Promise<Object>} Reorder response
   */
  async reorderNotes(noteIds) {
    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      throw new Error('Note IDs array is required');
    }

    // Validate all IDs are numbers
    const numericIds = noteIds.map(id => {
      const numId = parseInt(id);
      if (isNaN(numId)) {
        throw new Error(`Invalid note ID: ${id}`);
      }
      return numId;
    });

    return this.makeRequest('/notes/reorder', {
      method: 'PUT',
      body: { note_ids: numericIds },
    });
  }

  // ===================
  // Checklist Items
  // ===================

  /**
   * Update a checklist item
   * @param {number|string} noteId - Note ID
   * @param {number|string} itemId - Checklist item ID
   * @param {Object} itemData - Updated item data
   * @param {string} itemData.text - Item text
   * @param {boolean} itemData.completed - Completion status
   * @param {number} itemData.order - Item order
   * @returns {Promise<Object>} Updated checklist item
   */
  async updateChecklistItem(noteId, itemId, itemData) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!itemId) {
      throw new Error('Checklist item ID is required');
    }

    if (!itemData || typeof itemData !== 'object') {
      throw new Error('Item data is required');
    }

    return this.makeRequest(`/notes/${noteId}/checklist-items/${itemId}`, {
      method: 'PUT',
      body: itemData,
    });
  }

  /**
   * Add a new checklist item to a note
   * @param {number|string} noteId - Note ID
   * @param {Object} itemData - Item data
   * @param {string} itemData.text - Item text
   * @param {boolean} itemData.completed - Completion status (default: false)
   * @param {number} itemData.order - Item order
   * @returns {Promise<Object>} Created checklist item
   */
  async addChecklistItem(noteId, itemData) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!itemData || !itemData.text) {
      throw new Error('Item text is required');
    }

    return this.makeRequest(`/notes/${noteId}/checklist-items`, {
      method: 'POST',
      body: {
        text: itemData.text,
        completed: itemData.completed || false,
        order: itemData.order || 0,
      },
    });
  }

  /**
   * Delete a checklist item
   * @param {number|string} noteId - Note ID
   * @param {number|string} itemId - Checklist item ID
   * @returns {Promise<Object>} Success response
   */
  async deleteChecklistItem(noteId, itemId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!itemId) {
      throw new Error('Checklist item ID is required');
    }

    return this.makeRequest(`/notes/${noteId}/checklist-items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // ===================
  // Note Sharing
  // ===================

  /**
   * Share a note with another user
   * @param {number|string} noteId - Note ID
   * @param {Object} shareData - Share configuration
   * @param {string} shareData.username - Username to share with
   * @param {string} shareData.access_level - Access level ('read' or 'edit')
   * @returns {Promise<Object>} Share response
   */
  async shareNote(noteId, shareData) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!shareData || !shareData.username) {
      throw new Error('Username is required for sharing');
    }

    if (!shareData.access_level) {
      shareData.access_level = 'read';
    }

    if (!['read', 'edit'].includes(shareData.access_level)) {
      throw new Error('Access level must be "read" or "edit"');
    }

    return this.makeRequest(`/notes/${noteId}/share`, {
      method: 'POST',
      body: shareData,
    });
  }

  /**
   * Get sharing information for a note
   * @param {number|string} noteId - Note ID
   * @returns {Promise<Array>} Array of share records
   */
  async getNoteShares(noteId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    return this.makeRequest(`/notes/${noteId}/shares`);
  }

  /**
   * Remove sharing for a note
   * @param {number|string} noteId - Note ID
   * @param {number|string} shareId - Share record ID
   * @returns {Promise<Object>} Success response
   */
  async unshareNote(noteId, shareId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!shareId) {
      throw new Error('Share ID is required');
    }

    return this.makeRequest(`/notes/${noteId}/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Update sharing permissions for a note
   * @param {number|string} noteId - Note ID
   * @param {number|string} shareId - Share record ID
   * @param {Object} updateData - Update data
   * @param {string} updateData.access_level - New access level
   * @returns {Promise<Object>} Updated share record
   */
  async updateNoteShare(noteId, shareId, updateData) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!shareId) {
      throw new Error('Share ID is required');
    }

    if (!updateData || !updateData.access_level) {
      throw new Error('Access level is required');
    }

    if (!['read', 'edit'].includes(updateData.access_level)) {
      throw new Error('Access level must be "read" or "edit"');
    }

    return this.makeRequest(`/notes/${noteId}/shares/${shareId}`, {
      method: 'PUT',
      body: updateData,
    });
  }

  // ===================
  // Label Management
  // ===================

  /**
   * Get all labels for the authenticated user
   * @returns {Promise<Array>} Array of labels
   */
  async getLabels() {
    return this.makeRequest('/labels');
  }

  /**
   * Create a new label
   * @param {Object} labelData - Label data
   * @param {string} labelData.name - Label name
   * @param {string} labelData.color - Label color (hex)
   * @param {number} labelData.parent_id - Parent label ID (optional)
   * @returns {Promise<Object>} Created label
   */
  async createLabel(labelData) {
    if (!labelData || typeof labelData !== 'object') {
      throw new Error('Label data is required');
    }

    if (!labelData.name || !labelData.name.trim()) {
      throw new Error('Label name is required');
    }

    return this.makeRequest('/labels', {
      method: 'POST',
      body: labelData,
    });
  }

  /**
   * Update an existing label
   * @param {number|string} labelId - Label ID
   * @param {Object} labelData - Updated label data
   * @returns {Promise<Object>} Updated label
   */
  async updateLabel(labelId, labelData) {
    if (!labelId) {
      throw new Error('Label ID is required');
    }

    if (!labelData || typeof labelData !== 'object') {
      throw new Error('Label data is required');
    }

    return this.makeRequest(`/labels/${labelId}`, {
      method: 'PUT',
      body: labelData,
    });
  }

  /**
   * Delete a label
   * @param {number|string} labelId - Label ID
   * @returns {Promise<Object>} Success response
   */
  async deleteLabel(labelId) {
    if (!labelId) {
      throw new Error('Label ID is required');
    }

    return this.makeRequest(`/labels/${labelId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Search labels for autocomplete
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching labels
   */
  async searchLabels(query) {
    if (!query || !query.trim()) {
      return [];
    }

    const params = new URLSearchParams({ q: query.trim() });
    return this.makeRequest(`/labels/search?${params.toString()}`);
  }

  /**
   * Get label usage statistics
   * @returns {Promise<Array>} Label usage stats
   */
  async getLabelStats() {
    return this.makeRequest('/labels/stats');
  }

  /**
   * Add a label to a note
   * @param {number|string} noteId - Note ID
   * @param {number|string} labelId - Label ID
   * @returns {Promise<Object>} Association response
   */
  async addLabelToNote(noteId, labelId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!labelId) {
      throw new Error('Label ID is required');
    }

    // Ensure consistent types
    const numericNoteId = parseInt(noteId);
    const numericLabelId = parseInt(labelId);
    
    if (isNaN(numericNoteId) || isNaN(numericLabelId)) {
      throw new Error('Note ID and Label ID must be valid numbers');
    }

    return this.makeRequest(`/notes/${numericNoteId}/labels`, {
      method: 'POST',
      body: { label_id: numericLabelId },
    });
  }

  /**
   * Remove a label from a note
   * @param {number|string} noteId - Note ID
   * @param {number|string} labelId - Label ID
   * @returns {Promise<Object>} Success response
   */
  async removeLabelFromNote(noteId, labelId) {
    if (!noteId) {
      throw new Error('Note ID is required');
    }

    if (!labelId) {
      throw new Error('Label ID is required');
    }

    // Ensure consistent types for URL construction
    const numericNoteId = parseInt(noteId);
    const numericLabelId = parseInt(labelId);
    
    if (isNaN(numericNoteId) || isNaN(numericLabelId)) {
      throw new Error('Note ID and Label ID must be valid numbers');
    }

    return this.makeRequest(`/notes/${numericNoteId}/labels/${numericLabelId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all notes with a specific label
   * @param {number|string} labelId - Label ID
   * @returns {Promise<Array>} Array of notes with the label
   */
  async getNotesByLabel(labelId) {
    if (!labelId) {
      throw new Error('Label ID is required');
    }

    return this.makeRequest(`/labels/${labelId}/notes`);
  }

  /**
   * Get all users (admin only, legacy endpoint)
   * @returns {Promise<Array>} Array of users
   */
  async getUsers() {
    return this.makeRequest('/users');
  }

  /**
   * Create a new user (legacy endpoint)
   * @param {Object} userData - User data
   * @param {string} userData.username - Username
   * @param {string} userData.email - Email address
   * @param {string} userData.password - Password
   * @returns {Promise<Object>} Created user
   */
  async createUser(userData) {
    if (!userData || typeof userData !== 'object') {
      throw new Error('User data is required');
    }

    // Validate required fields
    const requiredFields = ['username', 'email'];
    for (const field of requiredFields) {
      if (!userData[field]) {
        throw new Error(`${field} is required`);
      }
    }

    return this.makeRequest('/users', {
      method: 'POST',
      body: userData,
    });
  }

  /**
   * Get a specific user by ID
   * @param {number|string} userId - User ID
   * @returns {Promise<Object>} User object
   */
  async getUser(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return this.makeRequest(`/users/${userId}`);
  }

  /**
   * Update a user
   * @param {number|string} userId - User ID
   * @param {Object} userData - Updated user data
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(userId, userData) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!userData || typeof userData !== 'object') {
      throw new Error('User data is required');
    }

    return this.makeRequest(`/users/${userId}`, {
      method: 'PUT',
      body: userData,
    });
  }

  /**
   * Delete a user
   * @param {number|string} userId - User ID
   * @returns {Promise<Object>} Success response
   */
  async deleteUser(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return this.makeRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // ===================
  // Search and Filtering
  // ===================

  /**
   * Search notes by query
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {string} filters.type - Note type filter
   * @param {boolean} filters.archived - Include archived notes
   * @returns {Promise<Array>} Array of matching notes
   */
  async searchNotes(query, filters = {}) {
    const params = new URLSearchParams();
    
    if (query) {
      params.append('q', query);
    }
    
    if (filters.type) {
      params.append('type', filters.type);
    }
    
    if (filters.archived !== undefined) {
      params.append('archived', filters.archived);
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/notes/search?${queryString}` : '/notes/search';
    
    return this.makeRequest(endpoint);
  }

  // ===================
  // Utility Methods
  // ===================

  /**
   * Check API health/status
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    return this.makeRequest('/health');
  }

  /**
   * Get API version information
   * @returns {Promise<Object>} Version info
   */
  async getVersion() {
    return this.makeRequest('/version');
  }

  /**
   * Upload a file (if supported by backend)
   * @param {File} file - File to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload response
   */
  async uploadFile(file, options = {}) {
    if (!file) {
      throw new Error('File is required');
    }

    const formData = new FormData();
    formData.append('file', file);
    
    if (options.noteId) {
      formData.append('note_id', options.noteId);
    }

    return this.makeRequest('/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it
      },
    });
  }

  /**
   * Download/export notes
   * @param {Object} options - Export options
   * @param {string} options.format - Export format ('json', 'csv', etc.)
   * @param {Array} options.noteIds - Specific note IDs to export
   * @returns {Promise<Blob>} Export file
   */
  async exportNotes(options = {}) {
    const params = new URLSearchParams();
    
    if (options.format) {
      params.append('format', options.format);
    }
    
    if (options.noteIds && options.noteIds.length > 0) {
      params.append('notes', options.noteIds.join(','));
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/export?${queryString}` : '/export';
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  // ===================
  // Batch Operations
  // ===================

  /**
   * Perform batch operations on multiple notes
   * @param {Object} operations - Batch operations
   * @param {Array} operations.delete - Note IDs to delete
   * @param {Array} operations.archive - Note IDs to archive
   * @param {Array} operations.unarchive - Note IDs to unarchive
   * @returns {Promise<Object>} Batch operation results
   */
  async batchNoteOperations(operations) {
    if (!operations || typeof operations !== 'object') {
      throw new Error('Operations object is required');
    }

    return this.makeRequest('/notes/batch', {
      method: 'POST',
      body: operations,
    });
  }
}

// Create and export a singleton instance
const apiClient = new APIClient();


export default apiClient;
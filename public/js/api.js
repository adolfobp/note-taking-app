/**
 * ============================================================================
 * API.JS - API Client & Utility Functions
 * ============================================================================
 *
 * Provides a centralized API client for communicating with the backend,
 * plus shared utility functions used throughout the frontend.
 *
 * ARCHITECTURE:
 * -------------
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  Frontend API Architecture                                          │
 *   │                                                                     │
 *   │  ┌─────────┐    ┌─────────────┐    ┌─────────────────────────────┐  │
 *   │  │ app.js  │───▶│   api.js    │───▶│  Backend (server.js)       │  │
 *   │  │ auth.js │    │ (API Client)│    │  /api/auth, /api/notes...  │  │
 *   │  └─────────┘    └─────────────┘    └─────────────────────────────┘  │
 *   │                                                                     │
 *   │  API Modules:                                                       │
 *   │  ├── authAPI    - Authentication (login, register, logout)         │
 *   │  ├── foldersAPI - Folder CRUD operations                           │
 *   │  ├── notesAPI   - Note CRUD, trash, attachments                    │
 *   │  └── aiAPI      - AI-powered features                              │
 *   │                                                                     │
 *   │  Utilities:                                                         │
 *   │  ├── showToast()      - User notifications                         │
 *   │  ├── formatDate()     - Relative date formatting                   │
 *   │  ├── getDateGroup()   - Group notes by date                        │
 *   │  └── stripHtml()      - Extract text from HTML                     │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * REQUEST HANDLING:
 * -----------------
 * All API requests go through apiRequest() which:
 * 1. Prepends /api to endpoints
 * 2. Sets JSON Content-Type (except for FormData)
 * 3. Includes credentials (session cookie)
 * 4. Parses JSON responses
 * 5. Converts server errors to consistent format
 *
 * ERROR FORMAT:
 * -------------
 * All errors (from server or network) are normalized to:
 * {
 *   message: "Human-readable error message",
 *   code: "ERROR_CODE",
 *   status: 400 (HTTP status or 0 for network errors)
 * }
 *
 * RELATED FILES:
 * - auth.js → Uses authAPI for login/register
 * - app.js → Uses all API modules and utilities
 * - ../index.html → Loads this file
 * - ../app.html → Loads this file
 *
 * @module public/js/api
 */

// ============================================================================
// API BASE CONFIGURATION
// ============================================================================

/**
 * API Base URL
 * All endpoints are relative to this path.
 */
const API_BASE = '/api';

// ============================================================================
// GENERIC API REQUEST HANDLER
// ============================================================================

/**
 * Generic Fetch Wrapper with Error Handling
 *
 * Handles all HTTP requests to the backend API with consistent:
 * - Header configuration
 * - Session cookie handling
 * - JSON parsing
 * - Error normalization
 *
 * @async
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @param {Object} options - Fetch options (method, body, headers)
 * @returns {Promise<Object>} Parsed JSON response from server
 * @throws {Object} Normalized error { message, code, status }
 *
 * @example
 * // GET request
 * const data = await apiRequest('/notes');
 *
 * // POST request with JSON body
 * const data = await apiRequest('/notes', {
 *   method: 'POST',
 *   body: JSON.stringify({ title: 'New Note' })
 * });
 *
 * // POST request with FormData (file upload)
 * const formData = new FormData();
 * formData.append('files', file);
 * const data = await apiRequest('/notes/123/attachments', {
 *   method: 'POST',
 *   body: formData
 * });
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  // Default options for all requests
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // IMPORTANT: Send session cookie with every request
  };

  // Merge options
  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    // Check for HTTP errors
    if (!response.ok) {
      throw {
        message: data.error?.message || 'An error occurred',
        code: data.error?.code || 'UNKNOWN_ERROR',
        status: response.status,
      };
    }

    return data;
  } catch (error) {
    // Re-throw if already formatted
    if (error.status) {
      throw error;
    }
    // Network or parsing error
    throw {
      message: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  }
}

// ============================================================================
// AUTHENTICATION API
// ============================================================================

/**
 * Authentication API Module
 *
 * Handles user authentication: registration, login, logout, and
 * session status checking.
 *
 * @namespace authAPI
 */
const authAPI = {
  /**
   * Register a new user account
   *
   * @param {string} username - Desired username (3-30 chars)
   * @param {string} email - Email address
   * @param {string} password - Password (min 6 chars)
   * @returns {Promise<Object>} { user, message }
   */
  async register(username, email, password) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  /**
   * Login with existing credentials
   *
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} { user, message }
   */
  async login(email, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Logout current user
   *
   * @returns {Promise<Object>} { message }
   */
  async logout() {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Get current authenticated user
   *
   * Used to check if user is logged in on page load.
   *
   * @returns {Promise<Object>} { user } or throws 401 if not authenticated
   */
  async getCurrentUser() {
    return apiRequest('/auth/me');
  },
};

// ============================================================================
// FOLDERS API
// ============================================================================

/**
 * Folders API Module
 *
 * Handles folder CRUD operations for organizing notes.
 *
 * @namespace foldersAPI
 */
const foldersAPI = {
  /**
   * Get all folders for current user
   *
   * @returns {Promise<Object>} { folders: [{ _id, name, noteCount }] }
   */
  async getAll() {
    return apiRequest('/folders');
  },

  /**
   * Create a new folder
   *
   * @param {string} name - Folder name
   * @returns {Promise<Object>} { folder: { _id, name, noteCount: 0 } }
   */
  async create(name) {
    return apiRequest('/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Rename a folder
   *
   * @param {string} id - Folder ID
   * @param {string} name - New folder name
   * @returns {Promise<Object>} { folder: { _id, name, noteCount } }
   */
  async update(id, name) {
    return apiRequest(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Delete a folder
   *
   * Notes in the folder are orphaned (not deleted).
   *
   * @param {string} id - Folder ID
   * @returns {Promise<Object>} { message }
   */
  async delete(id) {
    return apiRequest(`/folders/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// NOTES API
// ============================================================================

/**
 * Notes API Module
 *
 * Handles all note operations: CRUD, trash management, and file attachments.
 *
 * @namespace notesAPI
 */
const notesAPI = {
  /**
   * Get all active notes for current user
   *
   * @param {string|null} folderId - Optional folder ID to filter by
   * @returns {Promise<Object>} { notes: [...] }
   */
  async getAll(folderId = null) {
    const query = folderId ? `?folder=${folderId}` : '';
    return apiRequest(`/notes${query}`);
  },

  /**
   * Get all notes in trash
   *
   * @returns {Promise<Object>} { notes: [...] }
   */
  async getTrash() {
    return apiRequest('/notes/trash');
  },

  /**
   * Get a single note by ID
   *
   * @param {string} id - Note ID
   * @returns {Promise<Object>} { note: {...} }
   */
  async getOne(id) {
    return apiRequest(`/notes/${id}`);
  },

  /**
   * Create a new note
   *
   * @param {Object} data - Note data { title?, content?, folder? }
   * @returns {Promise<Object>} { note: {...} }
   */
  async create(data = {}) {
    return apiRequest('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an existing note
   *
   * @param {string} id - Note ID
   * @param {Object} data - Fields to update { title?, content?, folder? }
   * @returns {Promise<Object>} { note: {...} }
   */
  async update(id, data) {
    return apiRequest(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Soft delete a note (move to trash)
   *
   * @param {string} id - Note ID
   * @returns {Promise<Object>} { message }
   */
  async delete(id) {
    return apiRequest(`/notes/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Restore a note from trash
   *
   * @param {string} id - Note ID
   * @returns {Promise<Object>} { note: {...} }
   */
  async restore(id) {
    return apiRequest(`/notes/${id}/restore`, {
      method: 'POST',
    });
  },

  /**
   * Permanently delete a note
   *
   * This action is irreversible!
   *
   * @param {string} id - Note ID
   * @returns {Promise<Object>} { message }
   */
  async permanentDelete(id) {
    return apiRequest(`/notes/${id}/permanent`, {
      method: 'DELETE',
    });
  },

  /**
   * Upload file attachments to a note
   *
   * @param {string} noteId - Note ID
   * @param {File[]} files - Array of File objects to upload
   * @returns {Promise<Object>} { attachments: [...] }
   */
  async uploadAttachments(noteId, files) {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    return apiRequest(`/notes/${noteId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Delete a single attachment from a note
   *
   * @param {string} noteId - Note ID
   * @param {string} attachmentId - Attachment ID
   * @returns {Promise<Object>} { message }
   */
  async deleteAttachment(noteId, attachmentId) {
    return apiRequest(`/notes/${noteId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// AI API
// ============================================================================

/**
 * AI API Module
 *
 * Handles AI-powered features using Claude API.
 *
 * @namespace aiAPI
 */
const aiAPI = {
  /**
   * Generate an AI-suggested title for note content
   *
   * @param {string} content - HTML content from Quill editor
   * @returns {Promise<Object>} { title: "Suggested Title" }
   */
  async suggestTitle(content) {
    return apiRequest('/ai/suggest-title', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};

// ============================================================================
// UI UTILITY: TOAST NOTIFICATIONS
// ============================================================================

/**
 * Show a Toast Notification
 *
 * Displays a temporary message to the user that auto-dismisses.
 *
 * @param {string} message - Message to display
 * @param {string} type - Notification type: 'info', 'success', 'warning', 'error'
 *
 * @example
 * showToast('Note saved', 'success');
 * showToast('Failed to save', 'error');
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================================
// UTILITY: DATE FORMATTING
// ============================================================================

/**
 * Format Date for Note List Display
 *
 * Returns relative or formatted date based on how recent:
 * - Today: "2:30 PM"
 * - Yesterday: "Yesterday"
 * - This week: "Monday"
 * - Older: "Jan 15, 2024"
 *
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const noteDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today - noteDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today: show time
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    // This week: show day name
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    // Older: show full date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

/**
 * Get Date Group Label for Note Grouping
 *
 * Groups notes by:
 * - "Today"
 * - "Yesterday"
 * - "Previous 7 Days"
 * - "January" (month name for this year)
 * - "2023" (year for older)
 *
 * @param {string} dateString - ISO date string
 * @returns {string} Group label
 */
function getDateGroup(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const noteDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today - noteDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return 'Previous 7 Days';
  } else if (date.getFullYear() === now.getFullYear()) {
    // Same year: show month name
    return date.toLocaleDateString([], { month: 'long' });
  } else {
    // Different year: show year
    return date.getFullYear().toString();
  }
}

/**
 * Format Full Date and Time for Editor Display
 *
 * Returns format: "Jan 15, 2024 at 2:30 PM"
 *
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date and time
 */
function formatFullDateTime(dateString) {
  const date = new Date(dateString);
  const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOptions = { hour: 'numeric', minute: '2-digit' };

  const formattedDate = date.toLocaleDateString([], dateOptions);
  const formattedTime = date.toLocaleTimeString([], timeOptions);

  return `${formattedDate} at ${formattedTime}`;
}

// ============================================================================
// UTILITY: HTML PROCESSING
// ============================================================================

/**
 * Strip HTML Tags from String
 *
 * Extracts plain text from HTML content.
 * Used for note previews and search.
 *
 * @param {string} html - HTML string to process
 * @returns {string} Plain text content
 *
 * @example
 * stripHtml('<p>Hello <strong>world</strong></p>'); // "Hello world"
 */
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

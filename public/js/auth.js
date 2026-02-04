/**
 * ============================================================================
 * AUTH.JS - Authentication Page Controller
 * ============================================================================
 *
 * Handles the login and registration page logic.
 * This file manages the auth form state, validation, and submission.
 *
 * PAGE STRUCTURE:
 * ---------------
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │                    Authentication Page (index.html)                │
 *   │                                                                     │
 *   │   ┌─────────────────────────────────────────────────────────────┐   │
 *   │   │                                                             │   │
 *   │   │   [Username]     ← Hidden in login mode                    │   │
 *   │   │   [Email]                                                   │   │
 *   │   │   [Password]                                                │   │
 *   │   │   [Confirm Password]  ← Hidden in login mode               │   │
 *   │   │                                                             │   │
 *   │   │   [Sign In / Create Account]                               │   │
 *   │   │                                                             │   │
 *   │   │   Don't have an account? Create one                        │   │
 *   │   │                                                             │   │
 *   │   └─────────────────────────────────────────────────────────────┘   │
 *   │                                                                     │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * FLOW:
 * -----
 *
 * 1. Page Load:
 *    - Check if user is already logged in (via authAPI.getCurrentUser)
 *    - If logged in, redirect to /app.html
 *    - If not, show login form (default mode)
 *
 * 2. Toggle Mode:
 *    - User clicks "Create one" → Switch to register mode
 *    - User clicks "Sign in" → Switch back to login mode
 *    - Shows/hides username and confirm password fields
 *
 * 3. Form Submission:
 *    - Validate all fields (client-side)
 *    - Call authAPI.login() or authAPI.register()
 *    - On success, redirect to /app.html
 *    - On failure, show error message
 *
 * VALIDATION RULES:
 * -----------------
 * - Email: Required, must be valid format
 * - Password: Required, min 6 chars (register only)
 * - Username: Required in register mode, min 3 chars
 * - Confirm Password: Must match password (register only)
 *
 * RELATED FILES:
 * - ../index.html → The login/register page
 * - api.js → authAPI module
 * - ../app.html → Redirect destination after login
 *
 * @module public/js/auth
 */

document.addEventListener('DOMContentLoaded', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // INITIAL AUTH CHECK
  // ══════════════════════════════════════════════════════════════════════════

  // Check if user is already logged in
  checkAuthState();

  // ══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  const form = document.getElementById('auth-form');
  const usernameGroup = document.getElementById('username-group');
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const submitBtn = document.getElementById('submit-btn');
  const toggleLink = document.getElementById('toggle-link');
  const toggleText = document.getElementById('toggle-text');
  const subtitle = document.getElementById('auth-subtitle');
  const formError = document.getElementById('form-error');

  // ══════════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Current mode: true = login, false = register
   * @type {boolean}
   */
  let isLoginMode = true;

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH STATE CHECK
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Check if User is Already Authenticated
   *
   * If the user has a valid session, redirect to the app page.
   * This prevents logged-in users from seeing the login form.
   *
   * @async
   */
  async function checkAuthState() {
    try {
      const response = await authAPI.getCurrentUser();
      if (response.user) {
        // Already logged in, redirect to app
        window.location.href = '/app.html';
      }
    } catch (error) {
      // Not logged in, stay on login page
      // This is the expected state for unauthenticated users
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODE TOGGLE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Toggle Between Login and Register Modes
   *
   * Updates the UI to show/hide relevant fields and changes
   * button text and toggle link.
   */
  function toggleMode() {
    isLoginMode = !isLoginMode;

    if (isLoginMode) {
      // ── Login Mode ───────────────────────────────────────────────────────
      usernameGroup.style.display = 'none';
      confirmPasswordGroup.style.display = 'none';
      submitBtn.textContent = 'Sign In';
      subtitle.textContent = 'Sign in to your account';
      toggleText.innerHTML = `Don't have an account? <a href="#" id="toggle-link">Create one</a>`;
    } else {
      // ── Register Mode ────────────────────────────────────────────────────
      usernameGroup.style.display = 'block';
      usernameGroup.classList.add('slide-in');
      confirmPasswordGroup.style.display = 'block';
      confirmPasswordGroup.classList.add('slide-in');
      submitBtn.textContent = 'Create Account';
      subtitle.textContent = 'Create a new account';
      toggleText.innerHTML = `Already have an account? <a href="#" id="toggle-link">Sign in</a>`;
    }

    // Re-attach toggle listener (innerHTML replaced the link)
    document.getElementById('toggle-link').addEventListener('click', handleToggle);

    // Clear any existing errors
    clearErrors();
  }

  /**
   * Handle Toggle Link Click
   * @param {Event} e - Click event
   */
  function handleToggle(e) {
    e.preventDefault();
    toggleMode();
  }

  // Attach initial toggle listener
  toggleLink.addEventListener('click', handleToggle);

  // ══════════════════════════════════════════════════════════════════════════
  // FORM VALIDATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Validate Form Fields
   *
   * Performs client-side validation before submission.
   * Shows inline error messages for invalid fields.
   *
   * @returns {boolean} True if all fields are valid
   */
  function validateForm() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();
    const confirmPassword = document.getElementById('confirm-password').value;

    let isValid = true;
    clearErrors();

    // ── Email Validation ───────────────────────────────────────────────────
    if (!email) {
      showError('email', 'Email is required');
      isValid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      showError('email', 'Please enter a valid email');
      isValid = false;
    }

    // ── Password Validation ────────────────────────────────────────────────
    if (!password) {
      showError('password', 'Password is required');
      isValid = false;
    } else if (!isLoginMode && password.length < 6) {
      // Only check length for registration
      showError('password', 'Password must be at least 6 characters');
      isValid = false;
    }

    // ── Register-Specific Validations ──────────────────────────────────────
    if (!isLoginMode) {
      // Username validation
      if (!username) {
        showError('username', 'Username is required');
        isValid = false;
      } else if (username.length < 3) {
        showError('username', 'Username must be at least 3 characters');
        isValid = false;
      }

      // Confirm password validation
      if (password !== confirmPassword) {
        showError('confirm-password', 'Passwords do not match');
        isValid = false;
      }
    }

    return isValid;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR DISPLAY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Show Field-Level Error
   *
   * @param {string} field - Field name (e.g., 'email', 'password')
   * @param {string} message - Error message to display
   */
  function showError(field, message) {
    const errorEl = document.getElementById(`${field}-error`);
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  /**
   * Show Form-Level Error
   *
   * Displays a general error message at the form level
   * (e.g., "Invalid email or password").
   *
   * @param {string} message - Error message to display
   */
  function showFormError(message) {
    formError.textContent = message;
    formError.classList.add('visible');
  }

  /**
   * Clear All Error Messages
   */
  function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    formError.classList.remove('visible');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORM SUBMISSION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Handle Form Submission
   *
   * Validates form, calls API, and handles response.
   * Shows loading state during API call.
   */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate before submitting
    if (!validateForm()) {
      return;
    }

    // Get form values
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();

    // ── Show Loading State ─────────────────────────────────────────────────
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    try {
      // ── Call API ─────────────────────────────────────────────────────────
      if (isLoginMode) {
        await authAPI.login(email, password);
      } else {
        await authAPI.register(username, email, password);
      }

      // ── Success: Redirect to App ─────────────────────────────────────────
      window.location.href = '/app.html';
    } catch (error) {
      // ── Show Error ───────────────────────────────────────────────────────
      showFormError(error.message || 'An error occurred. Please try again.');
    } finally {
      // ── Reset Loading State ──────────────────────────────────────────────
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  });
});

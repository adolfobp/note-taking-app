/**
 * ============================================================================
 * AUTHCONTROLLER.JS - Authentication Business Logic
 * ============================================================================
 *
 * Handles user authentication operations: registration, login, logout,
 * and session status checking.
 *
 * AUTHENTICATION FLOW:
 * --------------------
 *
 * REGISTRATION:
 * 1. Validate input (username, email, password)
 * 2. Check for existing user (prevent duplicates)
 * 3. Create user with hashed password
 * 4. Auto-login after registration
 * 5. Return user data (sensitive fields stripped)
 *
 * LOGIN:
 * 1. Validate input (email, password)
 * 2. Passport authenticates via LocalStrategy
 * 3. On success, establish session
 * 4. Return user data
 *
 * LOGOUT:
 * 1. Destroy Passport session
 * 2. Return success message
 *
 * SESSION CHECK:
 * 1. Check if req.user exists (populated by Passport)
 * 2. Return user data or 401 error
 *
 * SECURITY CONSIDERATIONS:
 * ------------------------
 * - Passwords hashed using PBKDF2 (see User model)
 * - Generic "email or password" error prevents enumeration
 * - Session-based auth (not JWT) for simplicity
 * - Sensitive fields (password, salt) auto-removed via toJSON()
 *
 * RELATED FILES:
 * - ../models/User.js → User model with password methods
 * - ../config/passport.js → LocalStrategy configuration
 * - ../routes/authRoutes.js → Route definitions
 * - ../middleware/auth.js → isAuthenticated middleware
 *
 * @module controllers/authController
 */

const User = require('../models/User');
const passport = require('passport');

// ============================================================================
// REGISTER
// ============================================================================

/**
 * Register a New User
 *
 * Creates a new user account and automatically logs them in.
 *
 * @route POST /api/auth/register
 * @access Public (isNotAuthenticated middleware recommended)
 *
 * @param {Object} req.body
 * @param {string} req.body.username - Unique username (3-30 chars)
 * @param {string} req.body.email - Unique email address
 * @param {string} req.body.password - Password (min 6 chars)
 *
 * @returns {Object} 201 - { user, message: 'Registration successful' }
 * @returns {Object} 400 - Validation or duplicate error
 *
 * @example
 * // Request
 * POST /api/auth/register
 * { "username": "john", "email": "john@example.com", "password": "secret123" }
 *
 * // Response
 * { "user": { "_id": "...", "username": "john", "email": "john@example.com" },
 *   "message": "Registration successful" }
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // ── Input Validation ────────────────────────────────────────────────────
    if (!username || !email || !password) {
      return res.status(400).json({
        error: {
          message: 'Username, email, and password are required',
          code: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }

    // Password strength check (minimum requirement)
    if (password.length < 6) {
      return res.status(400).json({
        error: {
          message: 'Password must be at least 6 characters',
          code: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }

    // ── Duplicate Check ─────────────────────────────────────────────────────
    // Check both email and username in one query
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingUser) {
      // Determine which field caused the conflict
      const field = existingUser.email === email.toLowerCase() ? 'Email' : 'Username';
      return res.status(400).json({
        error: {
          message: `${field} already exists`,
          code: 'DUPLICATE_ERROR',
          status: 400
        }
      });
    }

    // ── Create User ─────────────────────────────────────────────────────────
    const user = new User({
      username,
      email: email.toLowerCase()  // Store email in lowercase
    });

    // Hash password using PBKDF2 (see User model)
    user.setPassword(password);

    // Save to database
    await user.save();

    // ── Auto-Login ──────────────────────────────────────────────────────────
    // Log the user in immediately after registration
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

      // Return user data (password/salt removed by toJSON)
      return res.status(201).json({
        user: user.toJSON(),
        message: 'Registration successful'
      });
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Login User
 *
 * Authenticates user credentials and establishes a session.
 *
 * @route POST /api/auth/login
 * @access Public (isNotAuthenticated middleware recommended)
 *
 * @param {Object} req.body
 * @param {string} req.body.email - User's email
 * @param {string} req.body.password - User's password
 *
 * @returns {Object} 200 - { user, message: 'Login successful' }
 * @returns {Object} 400 - Missing credentials
 * @returns {Object} 401 - Invalid credentials
 *
 * @example
 * // Request
 * POST /api/auth/login
 * { "email": "john@example.com", "password": "secret123" }
 *
 * // Response (sets session cookie)
 * { "user": { "_id": "...", "username": "john", "email": "john@example.com" },
 *   "message": "Login successful" }
 */
const login = (req, res, next) => {
  const { email, password } = req.body;

  // ── Input Validation ──────────────────────────────────────────────────────
  if (!email || !password) {
    return res.status(400).json({
      error: {
        message: 'Email and password are required',
        code: 'VALIDATION_ERROR',
        status: 400
      }
    });
  }

  // ── Passport Authentication ───────────────────────────────────────────────
  // Use custom callback to handle errors and responses
  passport.authenticate('local', (err, user, info) => {
    // Server error during authentication
    if (err) {
      return next(err);
    }

    // Authentication failed (wrong email or password)
    if (!user) {
      return res.status(401).json({
        error: {
          message: info.message || 'Invalid email or password',
          code: 'UNAUTHORIZED',
          status: 401
        }
      });
    }

    // ── Establish Session ─────────────────────────────────────────────────
    // req.login() serializes user and creates session
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

      return res.json({
        user: user.toJSON(),
        message: 'Login successful'
      });
    });
  })(req, res, next);  // Invoke the middleware
};

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Logout User
 *
 * Destroys the user's session.
 *
 * @route POST /api/auth/logout
 * @access Protected (isAuthenticated)
 *
 * @returns {Object} 200 - { message: 'Logout successful' }
 *
 * @example
 * // Request
 * POST /api/auth/logout
 *
 * // Response (clears session cookie)
 * { "message": "Logout successful" }
 */
const logout = (req, res, next) => {
  // Passport's logout method clears the session
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    res.json({
      message: 'Logout successful'
    });
  });
};

// ============================================================================
// GET CURRENT USER
// ============================================================================

/**
 * Get Current Authenticated User
 *
 * Returns the currently logged-in user's data.
 * Used by frontend to check authentication status on page load.
 *
 * @route GET /api/auth/me
 * @access Public (returns 401 if not authenticated)
 *
 * @returns {Object} 200 - { user }
 * @returns {Object} 401 - Not authenticated
 *
 * @example
 * // Request (with valid session cookie)
 * GET /api/auth/me
 *
 * // Response (authenticated)
 * { "user": { "_id": "...", "username": "john", "email": "john@example.com" } }
 *
 * // Response (not authenticated)
 * { "error": { "message": "Not authenticated", "code": "UNAUTHORIZED", "status": 401 } }
 */
const getCurrentUser = (req, res) => {
  // req.user is populated by Passport's deserializeUser
  if (req.user) {
    return res.json({
      user: req.user.toJSON()
    });
  }

  // No session or session expired
  return res.status(401).json({
    error: {
      message: 'Not authenticated',
      code: 'UNAUTHORIZED',
      status: 401
    }
  });
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  register,
  login,
  logout,
  getCurrentUser
};

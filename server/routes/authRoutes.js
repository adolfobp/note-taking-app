/**
 * ============================================================================
 * AUTHROUTES.JS - Authentication API Routes
 * ============================================================================
 *
 * Defines the Express routes for user authentication operations.
 * All routes are prefixed with /api/auth (configured in server.js).
 *
 * ROUTE OVERVIEW:
 * ---------------
 *
 *   METHOD   ENDPOINT              MIDDLEWARE         CONTROLLER
 *   ──────   ────────              ──────────         ──────────
 *   POST     /api/auth/register    isNotAuthenticated register
 *   POST     /api/auth/login       isNotAuthenticated login
 *   POST     /api/auth/logout      isAuthenticated    logout
 *   GET      /api/auth/me          (none)             getCurrentUser
 *
 * MIDDLEWARE USAGE:
 * -----------------
 *
 * isNotAuthenticated:
 *   - Applied to register and login routes
 *   - Prevents logged-in users from creating new accounts or logging in again
 *   - Returns 400 "Already authenticated" if user has valid session
 *
 * isAuthenticated:
 *   - Applied to logout route
 *   - Ensures only logged-in users can log out
 *   - Returns 401 "Unauthorized" if no valid session
 *
 * No middleware:
 *   - /me endpoint is public but returns 401 if not authenticated
 *   - Used by frontend to check auth status on page load
 *
 * AUTHENTICATION FLOW:
 * --------------------
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │                         FRONTEND                                    │
 *   │                                                                     │
 *   │   Page Load → GET /me → authenticated? → show app : show login     │
 *   │                                                                     │
 *   │   Login Form → POST /login → success? → redirect to app            │
 *   │                                                                     │
 *   │   Register Form → POST /register → success? → auto-login → app     │
 *   │                                                                     │
 *   │   Logout Button → POST /logout → redirect to login page            │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * SESSION MANAGEMENT:
 * -------------------
 * - Sessions are managed by express-session (configured in server.js)
 * - Session data stored in MongoDB via connect-mongo
 * - Passport serializes/deserializes user to/from session
 * - Session cookie sent on every request (credentials: 'include')
 *
 * RELATED FILES:
 * - ../controllers/authController.js → Route handlers
 * - ../middleware/auth.js → isAuthenticated, isNotAuthenticated
 * - ../config/passport.js → Passport LocalStrategy
 * - ../server.js → Express session configuration
 *
 * @module routes/authRoutes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * POST /api/auth/register
 *
 * Register a new user account.
 * On success, automatically logs in the new user.
 *
 * Middleware: isNotAuthenticated (must not be logged in)
 * Controller: authController.register
 *
 * Request body: { username, email, password }
 * Response: { user, message: 'Registration successful' }
 */
router.post('/register', isNotAuthenticated, authController.register);

/**
 * POST /api/auth/login
 *
 * Authenticate user and create session.
 * Uses Passport LocalStrategy for authentication.
 *
 * Middleware: isNotAuthenticated (must not be logged in)
 * Controller: authController.login
 *
 * Request body: { email, password }
 * Response: { user, message: 'Login successful' }
 */
router.post('/login', isNotAuthenticated, authController.login);

/**
 * POST /api/auth/logout
 *
 * Destroy user session and log out.
 *
 * Middleware: isAuthenticated (must be logged in)
 * Controller: authController.logout
 *
 * Request body: (none)
 * Response: { message: 'Logout successful' }
 */
router.post('/logout', isAuthenticated, authController.logout);

/**
 * GET /api/auth/me
 *
 * Check current authentication status and get user data.
 * Called by frontend on page load to determine if user is logged in.
 *
 * Middleware: (none) - handles both authenticated and unauthenticated
 * Controller: authController.getCurrentUser
 *
 * Response (authenticated): { user }
 * Response (not authenticated): 401 { error }
 */
router.get('/me', authController.getCurrentUser);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;

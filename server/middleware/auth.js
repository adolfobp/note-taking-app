/**
 * ============================================================================
 * AUTH.JS - Authentication Middleware
 * ============================================================================
 *
 * Provides Express middleware functions for protecting routes based on
 * authentication status. Works with Passport.js session authentication.
 *
 * MIDDLEWARE OVERVIEW:
 * --------------------
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  Authentication Middleware                                        │
 *   │                                                                   │
 *   │  isAuthenticated                                                  │
 *   │  ├── Used for: Protected resources (notes, folders, etc.)        │
 *   │  ├── Allows: Requests with valid session                         │
 *   │  └── Blocks: Unauthenticated requests (401 Unauthorized)         │
 *   │                                                                   │
 *   │  isNotAuthenticated                                               │
 *   │  ├── Used for: Login and register pages                          │
 *   │  ├── Allows: Requests WITHOUT valid session                      │
 *   │  └── Blocks: Already logged-in users (400 Already Authenticated) │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * HOW IT WORKS:
 * -------------
 *
 * Passport.js adds req.isAuthenticated() method to every request.
 * This method checks if the request has a valid session with a serialized user.
 *
 *   Request Flow:
 *   1. Client sends request with session cookie
 *   2. express-session parses cookie and loads session from MongoDB
 *   3. Passport's deserializeUser() loads user from session
 *   4. req.user is populated if session is valid
 *   5. req.isAuthenticated() returns true/false
 *
 * USAGE IN ROUTES:
 * ----------------
 *
 * // Protect a single route
 * router.get('/protected', isAuthenticated, controller.handler);
 *
 * // Protect all routes in a router
 * router.use(isAuthenticated);
 * router.get('/', controller.list);
 * router.post('/', controller.create);
 *
 * // Prevent authenticated access (login/register)
 * router.post('/login', isNotAuthenticated, authController.login);
 *
 * ERROR RESPONSES:
 * ----------------
 *
 * isAuthenticated returns 401 Unauthorized:
 * {
 *   "error": {
 *     "message": "You must be logged in to access this resource",
 *     "code": "UNAUTHORIZED",
 *     "status": 401
 *   }
 * }
 *
 * isNotAuthenticated returns 400 Bad Request:
 * {
 *   "error": {
 *     "message": "You are already logged in",
 *     "code": "ALREADY_AUTHENTICATED",
 *     "status": 400
 *   }
 * }
 *
 * RELATED FILES:
 * - ../config/passport.js → Passport configuration (serialize/deserialize)
 * - ../server.js → Session and Passport initialization
 * - ../routes/*.js → Route files that use these middleware
 *
 * @module middleware/auth
 */

// ============================================================================
// isAuthenticated
// ============================================================================

/**
 * Middleware to Require Authentication
 *
 * Checks if the user has a valid session. If authenticated, proceeds
 * to the next middleware/route handler. Otherwise, returns 401 error.
 *
 * Use this to protect routes that require a logged-in user.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * // Protect a route
 * router.get('/notes', isAuthenticated, noteController.getNotes);
 *
 * // Protect all routes in a router
 * router.use(isAuthenticated);
 */
const isAuthenticated = (req, res, next) => {
  // req.isAuthenticated() is added by Passport.js
  // Returns true if session contains a valid user
  if (req.isAuthenticated()) {
    return next();  // User is authenticated, proceed
  }

  // User is not authenticated, return 401
  return res.status(401).json({
    error: {
      message: 'You must be logged in to access this resource',
      code: 'UNAUTHORIZED',
      status: 401
    }
  });
};

// ============================================================================
// isNotAuthenticated
// ============================================================================

/**
 * Middleware to Require NO Authentication
 *
 * Checks if the user does NOT have a valid session. If not authenticated,
 * proceeds to the next middleware/route handler. Otherwise, returns 400 error.
 *
 * Use this for login and register routes to prevent already logged-in
 * users from creating new sessions or accounts.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * // Prevent logged-in users from accessing login page
 * router.post('/login', isNotAuthenticated, authController.login);
 *
 * // Prevent logged-in users from registering new account
 * router.post('/register', isNotAuthenticated, authController.register);
 */
const isNotAuthenticated = (req, res, next) => {
  // Check that user is NOT authenticated
  if (!req.isAuthenticated()) {
    return next();  // User is not authenticated, proceed
  }

  // User is already authenticated, return 400
  return res.status(400).json({
    error: {
      message: 'You are already logged in',
      code: 'ALREADY_AUTHENTICATED',
      status: 400
    }
  });
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  isAuthenticated,
  isNotAuthenticated
};

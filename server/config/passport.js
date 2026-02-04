/**
 * ============================================================================
 * PASSPORT.JS - Authentication Strategy Configuration
 * ============================================================================
 *
 * This module configures Passport.js for user authentication using the
 * Local Strategy (email/password). It handles login verification and
 * session management.
 *
 * AUTHENTICATION FLOW:
 * --------------------
 * 1. User submits email/password to /api/auth/login
 * 2. Passport's LocalStrategy verifies credentials
 * 3. On success: serializeUser() stores user._id in session
 * 4. On subsequent requests: deserializeUser() retrieves full user object
 * 5. User object available at req.user in all routes
 *
 * SESSION SERIALIZATION:
 * ----------------------
 * - serializeUser: Determines what data to store in the session (just _id)
 * - deserializeUser: Retrieves full user from DB on each request
 *
 * This approach minimizes session storage while keeping user data fresh.
 *
 * SECURITY NOTES:
 * - Generic error messages prevent email enumeration attacks
 * - Password verification uses PBKDF2 (see User model)
 * - Session stored server-side, only ID cookie sent to client
 *
 * RELATED FILES:
 * - ../server.js                → Initializes passport middleware
 * - ../models/User.js           → User model with validPassword() method
 * - ../controllers/authController.js → Uses passport.authenticate()
 * - ../middleware/auth.js       → Uses req.isAuthenticated()
 *
 * @module config/passport
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// ============================================================================
// LOCAL STRATEGY CONFIGURATION
// ============================================================================

/**
 * Configure Local Strategy for email/password authentication.
 *
 * The LocalStrategy expects 'username' and 'password' fields by default.
 * We override usernameField to use 'email' instead.
 *
 * Verification function receives:
 * @param {string} email - Email from login form
 * @param {string} password - Password from login form
 * @param {Function} done - Callback: done(error, user, info)
 *
 * done() callback patterns:
 * - done(null, user)          → Success, user authenticated
 * - done(null, false, {msg})  → Authentication failed (wrong credentials)
 * - done(error)               → Server error occurred
 */
passport.use(new LocalStrategy(
  {
    usernameField: 'email',    // Use 'email' field instead of 'username'
    passwordField: 'password'  // Default, but explicit for clarity
  },
  async (email, password, done) => {
    try {
      // Find user by email (case-insensitive)
      const user = await User.findOne({ email: email.toLowerCase() });

      // User not found - use generic message to prevent email enumeration
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Verify password using User model's validPassword method
      // This uses PBKDF2 with the stored salt
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Authentication successful - pass user to serializeUser
      return done(null, user);
    } catch (error) {
      // Database or other server error
      return done(error);
    }
  }
));

// ============================================================================
// SESSION SERIALIZATION
// ============================================================================

/**
 * Serialize User for Session Storage
 *
 * Called after successful authentication to determine what to store in session.
 * We only store the user's _id to minimize session data size.
 *
 * @param {Object} user - The authenticated user object
 * @param {Function} done - Callback: done(error, id)
 */
passport.serializeUser((user, done) => {
  // Store only the user's MongoDB _id in the session
  // This is retrieved from the session cookie on each request
  done(null, user._id);
});

/**
 * Deserialize User from Session
 *
 * Called on every request to retrieve the full user object from the database
 * using the _id stored in the session.
 *
 * After this runs, the user object is available at req.user
 *
 * @param {string} id - The user's MongoDB _id from session
 * @param {Function} done - Callback: done(error, user)
 */
passport.deserializeUser(async (id, done) => {
  try {
    // Fetch full user document from database
    const user = await User.findById(id);

    // Attach user to request object (available as req.user)
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Export configured passport instance
module.exports = passport;

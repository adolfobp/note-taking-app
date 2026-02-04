/**
 * ============================================================================
 * SERVER.JS - Application Entry Point
 * ============================================================================
 *
 * This is the main entry point for the Note-Taking App backend server.
 * It bootstraps the Express application and establishes the middleware pipeline.
 *
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * The server follows a layered architecture:
 *
 *   Request → Middleware Stack → Routes → Controllers → Models → Database
 *                                                              ↓
 *   Response ← Error Handler ← Controllers ← Models ← Database
 *
 * MIDDLEWARE PIPELINE (in order):
 * 1. CORS - Cross-origin resource sharing
 * 2. Body Parsers - JSON and URL-encoded data
 * 3. Session - Express session management
 * 4. Passport - Authentication initialization
 * 5. Static Files - Public assets and uploads
 * 6. Routes - API endpoint handlers
 * 7. 404 Handler - Undefined routes
 * 8. Error Handler - Global error processing
 *
 * RELATED FILES:
 * - ./config/db.js          → MongoDB connection
 * - ./config/passport.js    → Authentication strategy
 * - ./routes/*              → API route definitions
 * - ./middleware/*          → Custom middleware
 *
 * @module server
 */

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * Load environment variables from .env file BEFORE any other imports.
 * This ensures all modules have access to process.env variables.
 *
 * Required environment variables:
 * - MONGODB_URI: MongoDB connection string
 * - SESSION_SECRET: Secret key for session encryption
 * - PORT: Server port (optional, defaults to 3000)
 * - NODE_ENV: Environment mode (development/production)
 * - CLAUDE_API_KEY: API key for AI features (optional)
 */
require('dotenv').config();

// ============================================================================
// DEPENDENCIES
// ============================================================================

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

// ============================================================================
// LOCAL MODULE IMPORTS
// ============================================================================

/**
 * Database connection function.
 * Establishes MongoDB connection using Mongoose.
 * @see ./config/db.js
 */
const connectDB = require('./config/db');

/**
 * Passport authentication configuration.
 * Sets up local strategy and session serialization.
 * @see ./config/passport.js
 */
const passport = require('./config/passport');

/**
 * Global error handler middleware.
 * Processes all errors and returns standardized JSON responses.
 * @see ./middleware/errorHandler.js
 */
const { errorHandler } = require('./middleware/errorHandler');

// ============================================================================
// EXPRESS APP INITIALIZATION
// ============================================================================

/**
 * Create Express application instance.
 * This is the core application object that handles all HTTP requests.
 */
const app = express();

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

/**
 * Connect to MongoDB.
 * This is an async operation but we don't await it here.
 * The connection will be established before the first request.
 * If connection fails, the process will exit with an error.
 */
connectDB();

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 *
 * - origin: true - Reflects the request origin (allows all origins)
 * - credentials: true - Allows cookies to be sent with cross-origin requests
 *
 * This is essential for the frontend to communicate with the API
 * when running on different ports during development.
 */
app.use(cors({
  origin: true,
  credentials: true
}));

/**
 * Body Parsing Middleware
 *
 * express.json() - Parses JSON request bodies (Content-Type: application/json)
 * express.urlencoded() - Parses URL-encoded bodies (form submissions)
 *
 * After these middleware, req.body contains the parsed request data.
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Session Configuration
 *
 * express-session stores session data server-side and only sends a session ID
 * to the client via a cookie. This is more secure than storing data in cookies.
 *
 * Configuration options:
 * - secret: Key used to sign the session ID cookie (prevents tampering)
 * - resave: false - Don't save session if unmodified (performance optimization)
 * - saveUninitialized: false - Don't create session until something is stored
 * - cookie.secure: true in production (HTTPS only)
 * - cookie.maxAge: 24 hours session lifetime
 */
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

/**
 * Passport Authentication Initialization
 *
 * passport.initialize() - Sets up Passport on every request
 * passport.session() - Enables persistent login sessions
 *
 * After this middleware:
 * - req.isAuthenticated() - Returns true if user is logged in
 * - req.user - Contains the authenticated user object
 * - req.login() / req.logout() - Session management methods
 */
app.use(passport.initialize());
app.use(passport.session());

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

/**
 * Serve Static Files from Public Directory
 *
 * Makes all files in ../public accessible at the root URL.
 * Example: /public/css/styles.css → accessible at /css/styles.css
 *
 * This serves the frontend application (HTML, CSS, JS files).
 */
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Serve Uploaded Files
 *
 * Makes uploaded attachments accessible at /uploads/*
 * Example: /server/uploads/abc123.jpg → accessible at /uploads/abc123.jpg
 *
 * These are user-uploaded images and videos attached to notes.
 */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health Check Endpoint
 *
 * Simple endpoint to verify the server is running.
 * Useful for monitoring, load balancers, and deployment health checks.
 *
 * GET /api/health → { status: 'ok', message: '...', timestamp: '...' }
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * API Route Mounting
 *
 * Each route file handles a specific resource domain:
 *
 * /api/auth    → Authentication (login, register, logout)
 *                @see ./routes/authRoutes.js
 *
 * /api/folders → Folder management (CRUD operations)
 *                @see ./routes/folderRoutes.js
 *
 * /api/notes   → Note management (CRUD, trash, attachments)
 *                @see ./routes/noteRoutes.js
 *
 * /api/ai      → AI features (title suggestions)
 *                @see ./routes/aiRoutes.js
 */
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/folders', require('./routes/folderRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * 404 Handler for Undefined Routes
 *
 * This middleware catches all requests that don't match any route.
 *
 * Behavior:
 * - API routes (/api/*) → Returns JSON error response
 * - Other routes → Serves index.html (SPA fallback for client-side routing)
 */
app.use((req, res, next) => {
  // If it's an API route, return JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: {
        message: 'API endpoint not found',
        code: 'NOT_FOUND',
        status: 404
      }
    });
  }
  // For all other routes, serve index.html (SPA fallback)
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * Global Error Handler
 *
 * This must be the LAST middleware. It catches all errors thrown
 * or passed via next(error) throughout the application.
 *
 * Handles:
 * - Mongoose validation errors
 * - Duplicate key errors
 * - Custom API errors
 * - Multer file upload errors
 * - Unexpected server errors
 *
 * @see ./middleware/errorHandler.js
 */
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Start HTTP Server
 *
 * The server listens on the configured PORT (default: 3000).
 * Logs startup information including URL and environment mode.
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

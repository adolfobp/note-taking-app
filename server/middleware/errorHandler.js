/**
 * ============================================================================
 * ERRORHANDLER.JS - Global Error Handling Middleware
 * ============================================================================
 *
 * Provides centralized error handling for the entire application.
 * All errors thrown or passed via next(error) are caught here.
 *
 * ERROR HANDLING FLOW:
 * --------------------
 * 1. Error occurs in controller/middleware
 * 2. Error is thrown or passed to next(error)
 * 3. Express routes error to this middleware (must have 4 params)
 * 4. Error is categorized and formatted into standard response
 * 5. Client receives consistent error JSON structure
 *
 * STANDARD ERROR RESPONSE FORMAT:
 * -------------------------------
 * {
 *   "error": {
 *     "message": "Human-readable error description",
 *     "code": "ERROR_CODE",      // Machine-readable code for frontend handling
 *     "status": 400              // HTTP status code
 *   }
 * }
 *
 * ERROR CODES:
 * ------------
 * - VALIDATION_ERROR: Invalid input data (Mongoose validation or manual)
 * - DUPLICATE_ERROR: Unique constraint violation (email, username, etc.)
 * - INVALID_ID: Malformed MongoDB ObjectId
 * - FILE_TOO_LARGE: Multer file size limit exceeded
 * - UNAUTHORIZED: Not logged in
 * - FORBIDDEN: Logged in but no permission
 * - NOT_FOUND: Resource doesn't exist
 * - SERVER_ERROR: Unexpected internal error
 *
 * RELATED FILES:
 * - ../server.js → Mounts this as final middleware
 * - ../controllers/* → Throw errors or call next(error)
 * - ../../public/js/api.js → Parses error responses on frontend
 *
 * @module middleware/errorHandler
 */

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

/**
 * Custom API Error Class
 *
 * Use this class to throw errors with specific codes and status.
 * The error handler will recognize instances and format appropriately.
 *
 * @class APIError
 * @extends Error
 *
 * @example
 * // In a controller:
 * throw new APIError('Note not found', 'NOT_FOUND', 404);
 *
 * // Or pass to next:
 * return next(new APIError('Access denied', 'FORBIDDEN', 403));
 */
class APIError extends Error {
  /**
   * Create an API Error
   *
   * @param {string} message - Human-readable error message
   * @param {string} code - Machine-readable error code (e.g., 'NOT_FOUND')
   * @param {number} status - HTTP status code (e.g., 404)
   */
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

/**
 * Global Error Handler Middleware
 *
 * Express error handlers must have exactly 4 parameters (err, req, res, next)
 * to be recognized as error handling middleware.
 *
 * This middleware:
 * 1. Logs the error for debugging
 * 2. Identifies the error type (Mongoose, Multer, APIError, etc.)
 * 3. Returns standardized JSON response
 *
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (required but unused)
 */
const errorHandler = (err, req, res, next) => {
  // Log error for server-side debugging
  console.error('Error:', err.message);

  // ──────────────────────────────────────────────────────────────────────────
  // Mongoose Validation Error
  // Occurs when document fails schema validation (required fields, maxlength, etc.)
  // ──────────────────────────────────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    // Extract all validation messages into an array
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: {
        message: messages.join(', '),  // Combine multiple errors
        code: 'VALIDATION_ERROR',
        status: 400
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mongoose Duplicate Key Error
  // Occurs when unique index constraint is violated (code: 11000)
  // ──────────────────────────────────────────────────────────────────────────
  if (err.code === 11000) {
    // Extract the field that caused the duplicate
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      error: {
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        code: 'DUPLICATE_ERROR',
        status: 400
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mongoose Cast Error
  // Occurs when trying to convert invalid string to ObjectId
  // Example: /api/notes/invalid-id instead of /api/notes/507f1f77bcf86cd799439011
  // ──────────────────────────────────────────────────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID',
        status: 400
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Multer File Size Error
  // Occurs when uploaded file exceeds configured limit (50MB)
  // ──────────────────────────────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: {
        message: 'File too large. Maximum size is 50MB',
        code: 'FILE_TOO_LARGE',
        status: 400
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Custom API Error
  // Errors explicitly thrown with our APIError class
  // ──────────────────────────────────────────────────────────────────────────
  if (err instanceof APIError) {
    return res.status(err.status).json({
      error: {
        message: err.message,
        code: err.code,
        status: err.status
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Default Server Error
  // Catch-all for any unhandled errors
  // ──────────────────────────────────────────────────────────────────────────
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'SERVER_ERROR',
      status: err.status || 500
    }
  });
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  APIError,      // Custom error class for controllers to use
  errorHandler   // Middleware function for Express
};

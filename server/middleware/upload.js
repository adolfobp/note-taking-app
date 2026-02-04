/**
 * ============================================================================
 * UPLOAD.JS - File Upload Middleware (Multer Configuration)
 * ============================================================================
 *
 * Configures Multer for handling file uploads (note attachments).
 * Files are stored on disk with UUID filenames for security.
 *
 * MULTER OVERVIEW:
 * ----------------
 * Multer is a middleware for handling multipart/form-data (file uploads).
 * It processes uploaded files and makes them available via req.file or req.files.
 *
 * CONFIGURATION:
 * --------------
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  Upload Configuration                                             │
 *   │                                                                   │
 *   │  Storage:                                                         │
 *   │  ├── Destination: /server/uploads/                               │
 *   │  └── Filename: UUID + original extension                         │
 *   │      Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"        │
 *   │                                                                   │
 *   │  File Filter:                                                     │
 *   │  ├── Allowed: Images (jpeg, png, gif, webp)                      │
 *   │  └── Allowed: Videos (mp4, webm, quicktime)                      │
 *   │                                                                   │
 *   │  Limits:                                                          │
 *   │  └── Max file size: 50 MB                                        │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * FILE NAMING STRATEGY:
 * ---------------------
 *
 * Original filename: "vacation-photo.jpg"
 * Stored filename:   "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
 *
 * Why UUID filenames?
 * 1. Prevents filename collisions (two users upload "photo.jpg")
 * 2. Prevents path traversal attacks (malicious filenames like "../etc/passwd")
 * 3. Hides original filename from URL (privacy)
 *
 * The original filename is preserved in the Note.attachments array
 * and displayed to the user when viewing/downloading.
 *
 * UPLOAD FLOW:
 * ------------
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  File Upload Flow                                                   │
 *   │                                                                     │
 *   │  1. Client sends POST /api/notes/:id/attachments                   │
 *   │     Content-Type: multipart/form-data                              │
 *   │     files: [file1, file2, ...]                                     │
 *   │                                                                     │
 *   │  2. Multer middleware (this file):                                 │
 *   │     ├── Checks file type (fileFilter)                              │
 *   │     ├── Generates UUID filename                                    │
 *   │     ├── Saves file to /uploads/                                    │
 *   │     └── Populates req.files with file metadata                     │
 *   │                                                                     │
 *   │  3. Controller (noteController.uploadAttachments):                 │
 *   │     ├── Verifies note exists and user owns it                      │
 *   │     ├── Stores metadata in Note.attachments array                  │
 *   │     └── Returns attachment data to client                          │
 *   │                                                                     │
 *   │  req.files format:                                                  │
 *   │  [{                                                                 │
 *   │    fieldname: 'files',                                             │
 *   │    originalname: 'vacation-photo.jpg',                             │
 *   │    mimetype: 'image/jpeg',                                         │
 *   │    filename: 'a1b2c3d4-...-ef1234567890.jpg',                      │
 *   │    path: '/server/uploads/a1b2c3d4-...-ef1234567890.jpg',          │
 *   │    size: 1234567                                                   │
 *   │  }]                                                                 │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * ALLOWED FILE TYPES:
 * -------------------
 *
 * Images:
 * - image/jpeg (.jpg, .jpeg)
 * - image/png (.png)
 * - image/gif (.gif)
 * - image/webp (.webp)
 *
 * Videos:
 * - video/mp4 (.mp4)
 * - video/webm (.webm)
 * - video/quicktime (.mov)
 *
 * All other file types are rejected with an error.
 *
 * ERROR HANDLING:
 * ---------------
 * If a file is rejected (wrong type or too large), Multer throws an error.
 * This error is caught by the errorHandler middleware and returned as:
 *
 * {
 *   "error": {
 *     "message": "Invalid file type. Only images and videos are allowed.",
 *     "code": "MULTER_ERROR",
 *     "status": 400
 *   }
 * }
 *
 * USAGE IN ROUTES:
 * ----------------
 *
 * // Single file upload
 * router.post('/upload', upload.single('file'), controller.handler);
 *
 * // Multiple files (max 10)
 * router.post('/upload', upload.array('files', 10), controller.handler);
 *
 * RELATED FILES:
 * - ../routes/noteRoutes.js → Uses upload.array() for attachments
 * - ../controllers/noteController.js → Processes req.files
 * - ../middleware/errorHandler.js → Handles Multer errors
 * - ../models/Note.js → Stores attachment metadata
 *
 * @module middleware/upload
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

/**
 * Multer Disk Storage Configuration
 *
 * Defines where and how uploaded files are stored.
 */
const storage = multer.diskStorage({
  /**
   * Destination Directory
   *
   * All uploaded files are stored in /server/uploads/
   * This directory must exist and be writable.
   *
   * @param {Object} req - Express request object
   * @param {Object} file - Multer file object
   * @param {Function} cb - Callback (error, destination)
   */
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },

  /**
   * Filename Generation
   *
   * Generates a UUID filename with the original file extension.
   * This prevents collisions and path traversal attacks.
   *
   * @param {Object} req - Express request object
   * @param {Object} file - Multer file object
   * @param {Function} cb - Callback (error, filename)
   *
   * @example
   * Original: "My Photo.jpg"
   * Generated: "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
   */
  filename: (req, file, cb) => {
    // crypto.randomUUID() generates a secure UUID v4
    const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// ============================================================================
// FILE FILTER
// ============================================================================

/**
 * File Type Validation
 *
 * Checks if the uploaded file has an allowed MIME type.
 * Only images and videos are permitted.
 *
 * @param {Object} req - Express request object
 * @param {Object} file - Multer file object with mimetype property
 * @param {Function} cb - Callback (error, shouldAccept)
 */
const fileFilter = (req, file, cb) => {
  // Whitelist of allowed MIME types
  const allowedTypes = [
    // Images
    'image/jpeg',     // .jpg, .jpeg
    'image/png',      // .png
    'image/gif',      // .gif
    'image/webp',     // .webp
    // Videos
    'video/mp4',      // .mp4
    'video/webm',     // .webm
    'video/quicktime' // .mov
  ];

  if (allowedTypes.includes(file.mimetype)) {
    // File type is allowed
    cb(null, true);
  } else {
    // File type is not allowed - reject with error
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

// ============================================================================
// MULTER INSTANCE
// ============================================================================

/**
 * Configured Multer Instance
 *
 * Combines storage, file filter, and limits into a single middleware.
 *
 * Usage:
 * - upload.single('fieldname') - Single file
 * - upload.array('fieldname', maxCount) - Multiple files
 * - upload.fields([...]) - Mixed fields
 */
const upload = multer({
  storage: storage,       // Where and how to store files
  fileFilter: fileFilter, // Which files to accept
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size (50 * 1024 KB * 1024 bytes)
  }
});

// ============================================================================
// EXPORT
// ============================================================================

module.exports = upload;

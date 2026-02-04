/**
 * ============================================================================
 * NOTEROUTES.JS - Note Management API Routes
 * ============================================================================
 *
 * Defines the Express routes for note CRUD operations, trash management,
 * and file attachment handling.
 * All routes are prefixed with /api/notes (configured in server.js).
 *
 * ROUTE OVERVIEW:
 * ---------------
 *
 *   METHOD   ENDPOINT                             CONTROLLER
 *   ──────   ────────                             ──────────
 *   GET      /api/notes                           getNotes
 *   GET      /api/notes/trash                     getTrash
 *   GET      /api/notes/:id                       getNote
 *   POST     /api/notes                           createNote
 *   PUT      /api/notes/:id                       updateNote
 *   DELETE   /api/notes/:id                       deleteNote (soft)
 *   POST     /api/notes/:id/restore               restoreNote
 *   DELETE   /api/notes/:id/permanent             permanentlyDeleteNote
 *   POST     /api/notes/:id/attachments           uploadAttachments
 *   DELETE   /api/notes/:noteId/attachments/:aid  deleteAttachment
 *
 * AUTHENTICATION:
 * ---------------
 * All routes require authentication via router.use(isAuthenticated).
 *
 * ROUTE ORGANIZATION:
 * -------------------
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │  Note Routes Architecture                                          │
 *   │                                                                    │
 *   │  CRUD Operations:                                                  │
 *   │  ├── GET    /           List active notes (with folder filter)    │
 *   │  ├── POST   /           Create new note                           │
 *   │  ├── GET    /:id        Get single note                           │
 *   │  ├── PUT    /:id        Update note                               │
 *   │  └── DELETE /:id        Soft delete (→ trash)                     │
 *   │                                                                    │
 *   │  Trash Operations:                                                 │
 *   │  ├── GET    /trash           List trashed notes                   │
 *   │  ├── POST   /:id/restore     Restore from trash                   │
 *   │  └── DELETE /:id/permanent   Hard delete                          │
 *   │                                                                    │
 *   │  Attachment Operations:                                            │
 *   │  ├── POST   /:id/attachments        Upload files                  │
 *   │  └── DELETE /:noteId/attachments/:attachmentId  Delete file       │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * IMPORTANT: Route Order Matters!
 * -------------------------------
 * The /trash route MUST be defined BEFORE /:id routes.
 * Otherwise, Express will match "trash" as an :id parameter.
 *
 *   CORRECT ORDER:
 *   1. GET /trash        ← Specific literal route first
 *   2. GET /:id          ← Parameterized route after
 *
 * FILE UPLOAD CONFIGURATION:
 * --------------------------
 * The uploadAttachments route uses Multer middleware:
 *   upload.array('files', 10)
 *
 * - 'files': Form field name containing uploaded files
 * - 10: Maximum number of files per upload
 * - Files are stored in /server/uploads/ with UUID filenames
 * - Max file size: 50MB (configured in upload.js)
 * - Allowed types: images and videos only
 *
 * RELATED FILES:
 * - ../controllers/noteController.js → Route handlers
 * - ../middleware/auth.js → isAuthenticated middleware
 * - ../middleware/upload.js → Multer configuration
 * - ../models/Note.js → Note schema with attachments
 * - ../../public/js/app.js → Frontend note management
 * - ../../public/js/api.js → api.notes.* methods
 *
 * @module routes/noteRoutes
 */

const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { isAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Apply isAuthenticated to ALL note routes.
 * Every request to /api/notes/* will first pass through isAuthenticated.
 */
router.use(isAuthenticated);

// ============================================================================
// LIST ROUTES (must be before parameterized routes)
// ============================================================================

/**
 * GET /api/notes
 *
 * Get all active (non-deleted) notes for the current user.
 * Optionally filter by folder using query parameter.
 *
 * Controller: noteController.getNotes
 *
 * Query params: folder (optional folder ID)
 * Response: { notes: [...] }
 */
router.get('/', noteController.getNotes);

/**
 * GET /api/notes/trash
 *
 * Get all deleted notes for the current user.
 * Also triggers cleanup of notes deleted more than 30 days ago.
 *
 * IMPORTANT: Must be defined before /:id route!
 *
 * Controller: noteController.getTrash
 *
 * Response: { notes: [...] }
 */
router.get('/trash', noteController.getTrash);

// ============================================================================
// SINGLE NOTE ROUTES
// ============================================================================

/**
 * GET /api/notes/:id
 *
 * Get a single note by ID.
 * Works for both active and deleted notes.
 *
 * Controller: noteController.getNote
 *
 * URL params: id (note ID)
 * Response: { note: {...} }
 */
router.get('/:id', noteController.getNote);

/**
 * POST /api/notes
 *
 * Create a new note.
 *
 * Controller: noteController.createNote
 *
 * Request body: { title?, content?, folder? }
 * Response: { note: {...} }
 */
router.post('/', noteController.createNote);

/**
 * PUT /api/notes/:id
 *
 * Update an existing note.
 * Only active (non-deleted) notes can be updated.
 *
 * Controller: noteController.updateNote
 *
 * URL params: id (note ID)
 * Request body: { title?, content?, folder? }
 * Response: { note: {...} }
 */
router.put('/:id', noteController.updateNote);

// ============================================================================
// DELETE ROUTES
// ============================================================================

/**
 * DELETE /api/notes/:id
 *
 * Soft delete a note (move to trash).
 * Sets isDeleted=true and records deletedAt timestamp.
 *
 * Controller: noteController.deleteNote
 *
 * URL params: id (note ID)
 * Response: { message: 'Note moved to trash' }
 */
router.delete('/:id', noteController.deleteNote);

/**
 * POST /api/notes/:id/restore
 *
 * Restore a note from trash.
 * Sets isDeleted=false and clears deletedAt.
 *
 * Controller: noteController.restoreNote
 *
 * URL params: id (note ID)
 * Response: { note: {...} }
 */
router.post('/:id/restore', noteController.restoreNote);

/**
 * DELETE /api/notes/:id/permanent
 *
 * Permanently delete a note.
 * Removes from database and deletes all attachment files.
 * This action is irreversible!
 *
 * Controller: noteController.permanentlyDeleteNote
 *
 * URL params: id (note ID)
 * Response: { message: 'Note permanently deleted' }
 */
router.delete('/:id/permanent', noteController.permanentlyDeleteNote);

// ============================================================================
// ATTACHMENT ROUTES
// ============================================================================

/**
 * POST /api/notes/:id/attachments
 *
 * Upload file attachments to a note.
 *
 * Middleware: upload.array('files', 10)
 *   - Accepts up to 10 files per request
 *   - Files must be in 'files' form field
 *   - Max file size: 50MB
 *   - Allowed types: images and videos
 *
 * Controller: noteController.uploadAttachments
 *
 * URL params: id (note ID)
 * Request: multipart/form-data with 'files' field
 * Response: { attachments: [{ filename, originalName, mimetype, size, path }] }
 */
router.post('/:id/attachments', upload.array('files', 10), noteController.uploadAttachments);

/**
 * DELETE /api/notes/:noteId/attachments/:attachmentId
 *
 * Delete a single attachment from a note.
 * Removes from database and deletes the file from disk.
 *
 * Controller: noteController.deleteAttachment
 *
 * URL params:
 *   - noteId: Note ID
 *   - attachmentId: Attachment subdocument ID
 * Response: { message: 'Attachment deleted' }
 */
router.delete('/:noteId/attachments/:attachmentId', noteController.deleteAttachment);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;

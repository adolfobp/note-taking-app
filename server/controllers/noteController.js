/**
 * ============================================================================
 * NOTECONTROLLER.JS - Note Management Business Logic
 * ============================================================================
 *
 * Handles all CRUD operations for notes, including soft-delete (trash),
 * restoration, permanent deletion, and file attachment management.
 *
 * NOTE LIFECYCLE:
 * ---------------
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │                        NOTE STATES                               │
 *   │                                                                  │
 *   │   ┌─────────┐    deleteNote()    ┌─────────┐                    │
 *   │   │ ACTIVE  │ ─────────────────► │  TRASH  │                    │
 *   │   │         │                    │         │                    │
 *   │   │isDeleted│ ◄───────────────── │isDeleted│                    │
 *   │   │ = false │    restoreNote()   │ = true  │                    │
 *   │   └─────────┘                    └────┬────┘                    │
 *   │                                       │                         │
 *   │                        permanentlyDeleteNote()                  │
 *   │                                       │                         │
 *   │                                       ▼                         │
 *   │                               ┌─────────────┐                   │
 *   │                               │  DELETED    │                   │
 *   │                               │ (removed)   │                   │
 *   │                               └─────────────┘                   │
 *   │                                                                 │
 *   │   Notes in trash > 30 days are auto-deleted via                │
 *   │   Note.cleanupOldDeletedNotes()                                │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * OPERATIONS SUMMARY:
 * -------------------
 * - getNotes: List active notes (with optional folder filter)
 * - getTrash: List deleted notes (triggers 30-day cleanup)
 * - getNote: Get single note by ID
 * - createNote: Create new note
 * - updateNote: Update note title/content/folder
 * - deleteNote: Soft delete (move to trash)
 * - restoreNote: Restore from trash
 * - permanentlyDeleteNote: Hard delete (remove from DB)
 * - uploadAttachments: Add files to note
 * - deleteAttachment: Remove file from note
 *
 * FILE ATTACHMENT FLOW:
 * ---------------------
 *
 *   Frontend                  Multer                  Controller
 *   ────────                  ──────                  ──────────
 *      │                         │                         │
 *      │──── POST /notes/:id/attachments ────────────────►│
 *      │     (multipart/form-data)                        │
 *      │                         │                         │
 *      │                    Save files                     │
 *      │                    to /uploads/                   │
 *      │                    with UUID names                │
 *      │                         │                         │
 *      │                         │────── req.files ───────►│
 *      │                         │                         │
 *      │                         │             Store metadata in note
 *      │                         │             { filename, originalName,
 *      │                         │               mimetype, size, path }
 *      │                         │                         │
 *      │◄──────────────── { attachments } ────────────────│
 *
 * SECURITY:
 * ---------
 * All operations verify note ownership via req.user._id.
 * Users can only access/modify their own notes and attachments.
 *
 * RELATED FILES:
 * - ../models/Note.js → Note schema with attachments and soft-delete
 * - ../models/Folder.js → Folder model for organization
 * - ../routes/noteRoutes.js → Route definitions
 * - ../middleware/auth.js → isAuthenticated middleware
 * - ../middleware/upload.js → Multer configuration for attachments
 *
 * @module controllers/noteController
 */

const Note = require('../models/Note');
const Folder = require('../models/Folder');
const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// GET ALL NOTES
// ============================================================================

/**
 * Get All Notes for Current User
 *
 * Retrieves all active (non-deleted) notes for the authenticated user.
 * Can be filtered by folder ID via query parameter.
 *
 * @route GET /api/notes
 * @route GET /api/notes?folder=:folderId
 * @access Protected (isAuthenticated)
 *
 * @param {string} [req.query.folder] - Optional folder ID to filter by
 *
 * @returns {Object} 200 - { notes: [...] }
 * @returns {Object} 404 - Folder not found (if filtering)
 *
 * @example
 * // Get all notes
 * GET /api/notes
 *
 * // Get notes in specific folder
 * GET /api/notes?folder=507f1f77bcf86cd799439011
 *
 * // Response
 * { "notes": [{ "_id": "...", "title": "...", "folder": { "_id": "...", "name": "Work" } }] }
 */
const getNotes = async (req, res, next) => {
  try {
    const { folder } = req.query;

    // ── Build Query ────────────────────────────────────────────────────────
    const query = {
      user: req.user._id,
      isDeleted: false  // Only active notes
    };

    // ── Optional Folder Filter ─────────────────────────────────────────────
    if (folder) {
      // Verify folder belongs to user before filtering
      const folderExists = await Folder.findOne({
        _id: folder,
        user: req.user._id
      });

      if (!folderExists) {
        return res.status(404).json({
          error: {
            message: 'Folder not found',
            code: 'NOT_FOUND',
            status: 404
          }
        });
      }

      query.folder = folder;
    }

    // ── Execute Query ──────────────────────────────────────────────────────
    // Sort by last updated (most recent first)
    // Populate folder name for display
    const notes = await Note.find(query)
      .sort({ updatedAt: -1 })
      .populate('folder', 'name');

    res.json({ notes });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET TRASH
// ============================================================================

/**
 * Get Notes in Trash
 *
 * Retrieves all soft-deleted notes for the authenticated user.
 * Also triggers cleanup of notes deleted more than 30 days ago.
 *
 * @route GET /api/notes/trash
 * @access Protected (isAuthenticated)
 *
 * @returns {Object} 200 - { notes: [...] }
 *
 * @example
 * // Request
 * GET /api/notes/trash
 *
 * // Response
 * { "notes": [{ "_id": "...", "title": "Old Note", "deletedAt": "2024-01-01T..." }] }
 */
const getTrash = async (req, res, next) => {
  try {
    // ── Cleanup Old Deleted Notes ──────────────────────────────────────────
    // Automatically remove notes in trash for > 30 days
    // This runs every time trash is viewed
    await Note.cleanupOldDeletedNotes();

    // ── Get Trashed Notes ──────────────────────────────────────────────────
    // Sort by deletion date (most recently deleted first)
    const notes = await Note.find({
      user: req.user._id,
      isDeleted: true
    })
      .sort({ deletedAt: -1 })
      .populate('folder', 'name');

    res.json({ notes });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET SINGLE NOTE
// ============================================================================

/**
 * Get a Single Note by ID
 *
 * Retrieves a specific note including both active and deleted notes.
 * Used for viewing/editing notes and viewing trash items.
 *
 * @route GET /api/notes/:id
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Note ID
 *
 * @returns {Object} 200 - { note: {...} }
 * @returns {Object} 404 - Note not found or not owned by user
 *
 * @example
 * // Request
 * GET /api/notes/507f1f77bcf86cd799439011
 *
 * // Response
 * {
 *   "note": {
 *     "_id": "...",
 *     "title": "My Note",
 *     "content": "<p>Hello world</p>",
 *     "folder": { "_id": "...", "name": "Work" },
 *     "attachments": [...],
 *     "createdAt": "...",
 *     "updatedAt": "..."
 *   }
 * }
 */
const getNote = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Find Note ──────────────────────────────────────────────────────────
    // Note: Does NOT filter by isDeleted, allowing trash viewing
    const note = await Note.findOne({
      _id: id,
      user: req.user._id
    }).populate('folder', 'name');

    if (!note) {
      return res.status(404).json({
        error: {
          message: 'Note not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    res.json({ note });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CREATE NOTE
// ============================================================================

/**
 * Create a New Note
 *
 * Creates a new note with optional title, content, and folder assignment.
 *
 * @route POST /api/notes
 * @access Protected (isAuthenticated)
 *
 * @param {Object} req.body
 * @param {string} [req.body.title='Untitled'] - Note title
 * @param {string} [req.body.content=''] - HTML content
 * @param {string} [req.body.folder=null] - Folder ID to assign
 *
 * @returns {Object} 201 - { note: {...} }
 * @returns {Object} 404 - Folder not found (if specified)
 *
 * @example
 * // Request
 * POST /api/notes
 * { "title": "New Note", "content": "<p>Hello</p>", "folder": "..." }
 *
 * // Response
 * { "note": { "_id": "...", "title": "New Note", ... } }
 */
const createNote = async (req, res, next) => {
  try {
    const { title, content, folder } = req.body;

    // ── Verify Folder Ownership ────────────────────────────────────────────
    if (folder) {
      const folderExists = await Folder.findOne({
        _id: folder,
        user: req.user._id
      });

      if (!folderExists) {
        return res.status(404).json({
          error: {
            message: 'Folder not found',
            code: 'NOT_FOUND',
            status: 404
          }
        });
      }
    }

    // ── Create Note ────────────────────────────────────────────────────────
    const note = new Note({
      title: title || 'Untitled',
      content: content || '',
      folder: folder || null,
      user: req.user._id
    });

    await note.save();
    await note.populate('folder', 'name');

    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// UPDATE NOTE
// ============================================================================

/**
 * Update an Existing Note
 *
 * Updates note title, content, and/or folder assignment.
 * Only active (non-deleted) notes can be updated.
 *
 * @route PUT /api/notes/:id
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Note ID to update
 * @param {Object} req.body
 * @param {string} [req.body.title] - New title
 * @param {string} [req.body.content] - New HTML content
 * @param {string|null} [req.body.folder] - New folder ID or null
 *
 * @returns {Object} 200 - { note: {...} }
 * @returns {Object} 404 - Note or folder not found
 *
 * @example
 * // Request - Update title and move to folder
 * PUT /api/notes/507f1f77bcf86cd799439011
 * { "title": "Updated Title", "folder": "..." }
 *
 * // Request - Remove from folder
 * PUT /api/notes/507f1f77bcf86cd799439011
 * { "folder": null }
 */
const updateNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, folder } = req.body;

    // ── Find Active Note ───────────────────────────────────────────────────
    const note = await Note.findOne({
      _id: id,
      user: req.user._id,
      isDeleted: false  // Can't update deleted notes
    });

    if (!note) {
      return res.status(404).json({
        error: {
          message: 'Note not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Verify New Folder Ownership ────────────────────────────────────────
    if (folder !== undefined) {
      if (folder !== null) {
        const folderExists = await Folder.findOne({
          _id: folder,
          user: req.user._id
        });

        if (!folderExists) {
          return res.status(404).json({
            error: {
              message: 'Folder not found',
              code: 'NOT_FOUND',
              status: 404
            }
          });
        }
      }
      note.folder = folder;
    }

    // ── Update Fields ──────────────────────────────────────────────────────
    if (title !== undefined) {
      note.title = title;
    }

    if (content !== undefined) {
      note.content = content;
    }

    await note.save();
    await note.populate('folder', 'name');

    res.json({ note });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SOFT DELETE (MOVE TO TRASH)
// ============================================================================

/**
 * Soft Delete a Note (Move to Trash)
 *
 * Marks a note as deleted without permanently removing it.
 * The note can be restored within 30 days.
 *
 * @route DELETE /api/notes/:id
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Note ID to delete
 *
 * @returns {Object} 200 - { message: 'Note moved to trash' }
 * @returns {Object} 404 - Note not found or already deleted
 *
 * @example
 * // Request
 * DELETE /api/notes/507f1f77bcf86cd799439011
 *
 * // Response
 * { "message": "Note moved to trash" }
 */
const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Find Active Note ───────────────────────────────────────────────────
    const note = await Note.findOne({
      _id: id,
      user: req.user._id,
      isDeleted: false  // Already deleted notes can't be "deleted" again
    });

    if (!note) {
      return res.status(404).json({
        error: {
          message: 'Note not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Mark as Deleted ────────────────────────────────────────────────────
    note.isDeleted = true;
    note.deletedAt = new Date();  // Track when deleted for 30-day cleanup
    await note.save();

    res.json({
      message: 'Note moved to trash'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// RESTORE FROM TRASH
// ============================================================================

/**
 * Restore a Note from Trash
 *
 * Restores a soft-deleted note to active status.
 * If the note's folder was deleted, the note is restored without a folder.
 *
 * @route POST /api/notes/:id/restore
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Note ID to restore
 *
 * @returns {Object} 200 - { note: {...} }
 * @returns {Object} 404 - Note not found in trash
 *
 * @example
 * // Request
 * POST /api/notes/507f1f77bcf86cd799439011/restore
 *
 * // Response
 * { "note": { "_id": "...", "isDeleted": false, "deletedAt": null, ... } }
 */
const restoreNote = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Find Deleted Note ──────────────────────────────────────────────────
    const note = await Note.findOne({
      _id: id,
      user: req.user._id,
      isDeleted: true  // Must be in trash to restore
    });

    if (!note) {
      return res.status(404).json({
        error: {
          message: 'Note not found in trash',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Check if Folder Still Exists ───────────────────────────────────────
    // If folder was deleted while note was in trash, orphan the note
    if (note.folder) {
      const folderExists = await Folder.findOne({
        _id: note.folder,
        user: req.user._id
      });

      if (!folderExists) {
        note.folder = null;  // Folder was deleted, orphan the note
      }
    }

    // ── Restore Note ───────────────────────────────────────────────────────
    note.isDeleted = false;
    note.deletedAt = null;
    await note.save();
    await note.populate('folder', 'name');

    res.json({ note });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// PERMANENT DELETE
// ============================================================================

/**
 * Permanently Delete a Note
 *
 * Removes a note from the database entirely. Also deletes all
 * associated attachment files from disk.
 *
 * This action is irreversible!
 *
 * @route DELETE /api/notes/:id/permanent
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Note ID to permanently delete
 *
 * @returns {Object} 200 - { message: 'Note permanently deleted' }
 * @returns {Object} 404 - Note not found
 *
 * @example
 * // Request
 * DELETE /api/notes/507f1f77bcf86cd799439011/permanent
 *
 * // Response
 * { "message": "Note permanently deleted" }
 */
const permanentlyDeleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Find Note ──────────────────────────────────────────────────────────
    // Works on both active and deleted notes
    const note = await Note.findOne({
      _id: id,
      user: req.user._id
    });

    if (!note) {
      return res.status(404).json({
        error: {
          message: 'Note not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Delete Attachment Files ────────────────────────────────────────────
    // Remove files from /uploads/ directory
    for (const attachment of note.attachments) {
      try {
        await fs.unlink(path.join(__dirname, '../uploads', attachment.filename));
      } catch (err) {
        // File may not exist (already deleted manually), continue
        console.error(`Failed to delete file: ${attachment.filename}`);
      }
    }

    // ── Delete Note Document ───────────────────────────────────────────────
    await note.deleteOne();

    res.json({
      message: 'Note permanently deleted'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// UPLOAD ATTACHMENTS
// ============================================================================

/**
 * Upload File Attachments to a Note
 *
 * Adds one or more file attachments to an existing note.
 * Files are saved to /uploads/ with UUID filenames.
 * Metadata is stored in the note's attachments array.
 *
 * This endpoint expects multipart/form-data with files in the 'files' field.
 * Maximum file size and types are configured in upload middleware.
 *
 * @route POST /api/notes/:id/attachments
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Note ID to attach files to
 * @param {File[]} req.files - Uploaded files (from Multer)
 *
 * @returns {Object} 200 - { attachments: [{ filename, originalName, ... }] }
 * @returns {Object} 400 - No files uploaded
 * @returns {Object} 404 - Note not found
 *
 * @example
 * // Request (multipart/form-data)
 * POST /api/notes/507f1f77bcf86cd799439011/attachments
 * Content-Type: multipart/form-data
 * files: [image.jpg, document.pdf]
 *
 * // Response
 * {
 *   "attachments": [
 *     { "filename": "uuid1.jpg", "originalName": "image.jpg", "mimetype": "image/jpeg", ... },
 *     { "filename": "uuid2.pdf", "originalName": "document.pdf", "mimetype": "application/pdf", ... }
 *   ]
 * }
 */
const uploadAttachments = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Find Active Note ───────────────────────────────────────────────────
    const note = await Note.findOne({
      _id: id,
      user: req.user._id,
      isDeleted: false
    });

    if (!note) {
      // ── Cleanup Uploaded Files ───────────────────────────────────────────
      // If note doesn't exist, delete the files that were already saved
      if (req.files) {
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            console.error(`Failed to delete file: ${file.path}`);
          }
        }
      }

      return res.status(404).json({
        error: {
          message: 'Note not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Validate Files ─────────────────────────────────────────────────────
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: {
          message: 'No files uploaded',
          code: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }

    // ── Store Attachment Metadata ──────────────────────────────────────────
    // Map Multer file objects to our attachment schema
    const newAttachments = req.files.map(file => ({
      filename: file.filename,        // UUID filename (e.g., "a1b2c3d4.jpg")
      originalName: file.originalname, // User's filename (e.g., "photo.jpg")
      mimetype: file.mimetype,         // MIME type (e.g., "image/jpeg")
      size: file.size,                 // File size in bytes
      path: `/uploads/${file.filename}` // URL path to access file
    }));

    note.attachments.push(...newAttachments);
    await note.save();

    res.json({ attachments: newAttachments });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE ATTACHMENT
// ============================================================================

/**
 * Delete a Single Attachment from a Note
 *
 * Removes an attachment from a note and deletes the file from disk.
 *
 * @route DELETE /api/notes/:noteId/attachments/:attachmentId
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.noteId - Note ID
 * @param {string} req.params.attachmentId - Attachment subdocument ID
 *
 * @returns {Object} 200 - { message: 'Attachment deleted' }
 * @returns {Object} 404 - Note or attachment not found
 *
 * @example
 * // Request
 * DELETE /api/notes/507f1f77bcf86cd799439011/attachments/60a1b2c3d4e5f67890123456
 *
 * // Response
 * { "message": "Attachment deleted" }
 */
const deleteAttachment = async (req, res, next) => {
  try {
    const { noteId, attachmentId } = req.params;

    // ── Find Note ──────────────────────────────────────────────────────────
    const note = await Note.findOne({
      _id: noteId,
      user: req.user._id
    });

    if (!note) {
      return res.status(404).json({
        error: {
          message: 'Note not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Find Attachment ────────────────────────────────────────────────────
    // Use Mongoose's subdocument .id() method
    const attachment = note.attachments.id(attachmentId);

    if (!attachment) {
      return res.status(404).json({
        error: {
          message: 'Attachment not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Delete File from Disk ──────────────────────────────────────────────
    try {
      await fs.unlink(path.join(__dirname, '../uploads', attachment.filename));
    } catch (err) {
      // File may not exist, log but continue
      console.error(`Failed to delete file: ${attachment.filename}`);
    }

    // ── Remove from Note ───────────────────────────────────────────────────
    note.attachments.pull(attachmentId);
    await note.save();

    res.json({
      message: 'Attachment deleted'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getNotes,
  getTrash,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
  permanentlyDeleteNote,
  uploadAttachments,
  deleteAttachment
};

/**
 * ============================================================================
 * FOLDERCONTROLLER.JS - Folder Management Business Logic
 * ============================================================================
 *
 * Handles CRUD operations for folders which organize user notes into
 * categories. Each user has their own set of folders with unique names.
 *
 * FOLDER OPERATIONS:
 * ------------------
 *
 * GET FOLDERS:
 * 1. Query all folders for current user
 * 2. Count notes in each folder (excluding deleted notes)
 * 3. Return folders with note counts
 *
 * CREATE FOLDER:
 * 1. Validate folder name (required, non-empty)
 * 2. Check for duplicate names within user's folders
 * 3. Create and save new folder
 * 4. Return folder with noteCount: 0
 *
 * UPDATE FOLDER:
 * 1. Verify folder exists and belongs to user
 * 2. Check new name doesn't conflict with existing folders
 * 3. Update name and return updated folder with note count
 *
 * DELETE FOLDER:
 * 1. Verify folder exists and belongs to user
 * 2. Orphan all notes in folder (set folder to null)
 * 3. Delete the folder document
 *
 * CASCADE BEHAVIOR:
 * -----------------
 * When a folder is deleted:
 * - Notes are NOT deleted
 * - Notes have their folder field set to null
 * - Notes appear in "All Notes" view (no folder)
 *
 * This preserves user data while removing the organization structure.
 *
 * DATA RELATIONSHIPS:
 * -------------------
 *            ┌─────────────────┐
 *            │      User       │
 *            └────────┬────────┘
 *                     │ 1
 *                     │ owns
 *                     ▼ *
 *            ┌─────────────────┐
 *            │     Folder      │ ◄─── THIS CONTROLLER
 *            └────────┬────────┘
 *                     │ 1
 *                     │ contains
 *                     ▼ *
 *            ┌─────────────────┐
 *            │      Note       │
 *            └─────────────────┘
 *
 * SECURITY:
 * ---------
 * All operations verify folder ownership via req.user._id.
 * Users can only access/modify their own folders.
 *
 * RELATED FILES:
 * - ../models/Folder.js → Folder schema and validation
 * - ../models/Note.js → Note model (for counting and orphaning)
 * - ../routes/folderRoutes.js → Route definitions
 * - ../middleware/auth.js → isAuthenticated middleware
 *
 * @module controllers/folderController
 */

const Folder = require('../models/Folder');
const Note = require('../models/Note');

// ============================================================================
// GET ALL FOLDERS
// ============================================================================

/**
 * Get All Folders for Current User
 *
 * Retrieves all folders owned by the authenticated user,
 * including a count of active notes in each folder.
 *
 * @route GET /api/folders
 * @access Protected (isAuthenticated)
 *
 * @returns {Object} 200 - { folders: [{ ...folderData, noteCount }] }
 *
 * @example
 * // Request
 * GET /api/folders
 *
 * // Response
 * {
 *   "folders": [
 *     { "_id": "...", "name": "Work", "noteCount": 5, "createdAt": "..." },
 *     { "_id": "...", "name": "Personal", "noteCount": 3, "createdAt": "..." }
 *   ]
 * }
 */
const getFolders = async (req, res, next) => {
  try {
    // ── Query User's Folders ───────────────────────────────────────────────
    // Sorted by creation date (newest first)
    const folders = await Folder.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    // ── Add Note Counts ────────────────────────────────────────────────────
    // For each folder, count active (non-deleted) notes
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const noteCount = await Note.countDocuments({
          folder: folder._id,
          user: req.user._id,
          isDeleted: false  // Only count active notes
        });
        return {
          ...folder.toObject(),
          noteCount
        };
      })
    );

    res.json({ folders: foldersWithCounts });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CREATE FOLDER
// ============================================================================

/**
 * Create a New Folder
 *
 * Creates a new folder for organizing notes. Folder names must be
 * unique within the user's account.
 *
 * @route POST /api/folders
 * @access Protected (isAuthenticated)
 *
 * @param {Object} req.body
 * @param {string} req.body.name - Folder name (required, max 50 chars)
 *
 * @returns {Object} 201 - { folder: { ...folderData, noteCount: 0 } }
 * @returns {Object} 400 - Validation error or duplicate name
 *
 * @example
 * // Request
 * POST /api/folders
 * { "name": "Work Projects" }
 *
 * // Response
 * { "folder": { "_id": "...", "name": "Work Projects", "noteCount": 0 } }
 */
const createFolder = async (req, res, next) => {
  try {
    const { name } = req.body;

    // ── Input Validation ───────────────────────────────────────────────────
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: {
          message: 'Folder name is required',
          code: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }

    // ── Duplicate Check ────────────────────────────────────────────────────
    // Check if folder with same name exists for this user
    const existingFolder = await Folder.findOne({
      name: name.trim(),
      user: req.user._id
    });

    if (existingFolder) {
      return res.status(400).json({
        error: {
          message: 'A folder with this name already exists',
          code: 'DUPLICATE_ERROR',
          status: 400
        }
      });
    }

    // ── Create Folder ──────────────────────────────────────────────────────
    const folder = new Folder({
      name: name.trim(),
      user: req.user._id
    });

    await folder.save();

    // Return with noteCount: 0 (new folder has no notes)
    res.status(201).json({
      folder: { ...folder.toObject(), noteCount: 0 }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// UPDATE FOLDER
// ============================================================================

/**
 * Update (Rename) a Folder
 *
 * Changes the name of an existing folder. The new name must not
 * conflict with other folders owned by the same user.
 *
 * @route PUT /api/folders/:id
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Folder ID to update
 * @param {Object} req.body
 * @param {string} req.body.name - New folder name
 *
 * @returns {Object} 200 - { folder: { ...folderData, noteCount } }
 * @returns {Object} 400 - Validation error or duplicate name
 * @returns {Object} 404 - Folder not found or not owned by user
 *
 * @example
 * // Request
 * PUT /api/folders/507f1f77bcf86cd799439011
 * { "name": "Work - Archive" }
 *
 * // Response
 * { "folder": { "_id": "...", "name": "Work - Archive", "noteCount": 5 } }
 */
const updateFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // ── Input Validation ───────────────────────────────────────────────────
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: {
          message: 'Folder name is required',
          code: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }

    // ── Find and Verify Ownership ──────────────────────────────────────────
    const folder = await Folder.findOne({ _id: id, user: req.user._id });

    if (!folder) {
      return res.status(404).json({
        error: {
          message: 'Folder not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Check for Name Conflict ────────────────────────────────────────────
    // Exclude current folder from duplicate check
    const existingFolder = await Folder.findOne({
      name: name.trim(),
      user: req.user._id,
      _id: { $ne: id }  // Not the current folder
    });

    if (existingFolder) {
      return res.status(400).json({
        error: {
          message: 'A folder with this name already exists',
          code: 'DUPLICATE_ERROR',
          status: 400
        }
      });
    }

    // ── Update Folder ──────────────────────────────────────────────────────
    folder.name = name.trim();
    await folder.save();

    // ── Get Note Count ─────────────────────────────────────────────────────
    const noteCount = await Note.countDocuments({
      folder: folder._id,
      user: req.user._id,
      isDeleted: false
    });

    res.json({
      folder: { ...folder.toObject(), noteCount }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE FOLDER
// ============================================================================

/**
 * Delete a Folder
 *
 * Permanently deletes a folder. Notes inside the folder are NOT deleted;
 * instead, they are "orphaned" (folder set to null) and will appear in
 * the "All Notes" view.
 *
 * @route DELETE /api/folders/:id
 * @access Protected (isAuthenticated)
 *
 * @param {string} req.params.id - Folder ID to delete
 *
 * @returns {Object} 200 - { message: 'Folder deleted successfully' }
 * @returns {Object} 404 - Folder not found or not owned by user
 *
 * @example
 * // Request
 * DELETE /api/folders/507f1f77bcf86cd799439011
 *
 * // Response
 * { "message": "Folder deleted successfully" }
 *
 * // Side effect: All notes in this folder now have folder: null
 */
const deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Find and Verify Ownership ──────────────────────────────────────────
    const folder = await Folder.findOne({ _id: id, user: req.user._id });

    if (!folder) {
      return res.status(404).json({
        error: {
          message: 'Folder not found',
          code: 'NOT_FOUND',
          status: 404
        }
      });
    }

    // ── Orphan Notes ───────────────────────────────────────────────────────
    // Move all notes in this folder to no folder (null)
    // This preserves the notes while removing the organization
    await Note.updateMany(
      { folder: id, user: req.user._id },
      { $set: { folder: null } }
    );

    // ── Delete Folder ──────────────────────────────────────────────────────
    await folder.deleteOne();

    res.json({
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder
};

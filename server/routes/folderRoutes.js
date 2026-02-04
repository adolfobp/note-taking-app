/**
 * ============================================================================
 * FOLDERROUTES.JS - Folder Management API Routes
 * ============================================================================
 *
 * Defines the Express routes for folder CRUD operations.
 * All routes are prefixed with /api/folders (configured in server.js).
 *
 * ROUTE OVERVIEW:
 * ---------------
 *
 *   METHOD   ENDPOINT             CONTROLLER
 *   ──────   ────────             ──────────
 *   GET      /api/folders         getFolders
 *   POST     /api/folders         createFolder
 *   PUT      /api/folders/:id     updateFolder
 *   DELETE   /api/folders/:id     deleteFolder
 *
 * AUTHENTICATION:
 * ---------------
 * All routes require authentication via router.use(isAuthenticated).
 * This means every request to /api/folders/* must include a valid session.
 *
 * RESTFUL PATTERN:
 * ----------------
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  RESTful CRUD for Folders                                        │
 *   │                                                                  │
 *   │  GET    /folders      → List all folders                        │
 *   │  POST   /folders      → Create new folder                       │
 *   │  PUT    /folders/:id  → Update folder (rename)                  │
 *   │  DELETE /folders/:id  → Delete folder (orphans notes)           │
 *   │                                                                  │
 *   │  Note: No GET /folders/:id endpoint because folder details      │
 *   │  are always fetched as part of the list (with note counts)      │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * FRONTEND USAGE:
 * ---------------
 * The folder list in the sidebar calls these endpoints:
 *
 *   ┌─────────────────────────┐
 *   │  Folders                │
 *   │  ─────────────────────  │
 *   │  📁 Work (5)           │ ← GET /folders returns note counts
 *   │  📁 Personal (3)       │
 *   │  ─────────────────────  │
 *   │  [+ New Folder]        │ ← POST /folders
 *   └─────────────────────────┘
 *
 *   Right-click context menu:
 *   - "Rename" → PUT /folders/:id
 *   - "Delete" → DELETE /folders/:id
 *
 * RELATED FILES:
 * - ../controllers/folderController.js → Route handlers
 * - ../middleware/auth.js → isAuthenticated middleware
 * - ../models/Folder.js → Folder schema
 * - ../../public/js/app.js → Frontend folder management
 * - ../../public/js/api.js → api.folders.* methods
 *
 * @module routes/folderRoutes
 */

const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { isAuthenticated } = require('../middleware/auth');

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Apply isAuthenticated to ALL folder routes.
 *
 * This is more efficient than adding it to each route individually.
 * Every request to /api/folders/* will first pass through isAuthenticated.
 */
router.use(isAuthenticated);

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /api/folders
 *
 * Get all folders for the current user.
 * Includes a note count for each folder.
 *
 * Controller: folderController.getFolders
 *
 * Response: { folders: [{ _id, name, noteCount, createdAt }] }
 */
router.get('/', folderController.getFolders);

/**
 * POST /api/folders
 *
 * Create a new folder.
 * Folder name must be unique within the user's account.
 *
 * Controller: folderController.createFolder
 *
 * Request body: { name }
 * Response: { folder: { _id, name, noteCount: 0, createdAt } }
 */
router.post('/', folderController.createFolder);

/**
 * PUT /api/folders/:id
 *
 * Update a folder (rename).
 * New name must not conflict with existing folders.
 *
 * Controller: folderController.updateFolder
 *
 * URL params: id (folder ID)
 * Request body: { name }
 * Response: { folder: { _id, name, noteCount, createdAt } }
 */
router.put('/:id', folderController.updateFolder);

/**
 * DELETE /api/folders/:id
 *
 * Delete a folder.
 * Notes in the folder are orphaned (not deleted).
 *
 * Controller: folderController.deleteFolder
 *
 * URL params: id (folder ID)
 * Response: { message: 'Folder deleted successfully' }
 */
router.delete('/:id', folderController.deleteFolder);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;

/**
 * ============================================================================
 * FOLDER.JS - Folder Organization Model
 * ============================================================================
 *
 * Defines the Folder schema for organizing notes into categories.
 * Folders provide a hierarchical structure for note management.
 *
 * SCHEMA OVERVIEW:
 * ----------------
 * - name: Folder display name (max 50 characters)
 * - user: Reference to owning User (required)
 * - createdAt: Folder creation timestamp
 *
 * UNIQUE CONSTRAINT:
 * ------------------
 * A compound unique index on (name, user) ensures:
 * - Each user can have only one folder with a given name
 * - Different users can have folders with the same name
 *
 * DATA RELATIONSHIPS:
 * -------------------
 *            ┌─────────────────┐
 *            │      User       │
 *            └────────┬────────┘
 *                     │ 1
 *                     │
 *                     │ owns
 *                     │
 *                     ▼ *
 *            ┌─────────────────┐
 *            │     Folder      │ ◄─── YOU ARE HERE
 *            └────────┬────────┘
 *                     │ 1
 *                     │
 *                     │ contains
 *                     │
 *                     ▼ *
 *            ┌─────────────────┐
 *            │      Note       │
 *            └─────────────────┘
 *
 * CASCADE BEHAVIOR:
 * - When a folder is deleted, its notes are NOT deleted
 * - Instead, notes have their folder field set to null (orphaned)
 * - This is handled in folderController.deleteFolder()
 *
 * RELATED FILES:
 * - ../models/User.js → Referenced via 'user' field
 * - ../models/Note.js → References Folder via 'folder' field
 * - ../controllers/folderController.js → CRUD operations
 * - ../routes/folderRoutes.js → API endpoints
 *
 * @module models/Folder
 */

const mongoose = require('mongoose');

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

/**
 * Folder Schema
 *
 * Simple schema for organizing notes into named categories.
 * Each folder belongs to exactly one user.
 */
const folderSchema = new mongoose.Schema({
  /**
   * Folder name - Display name shown in the sidebar
   * Must be unique per user (enforced by compound index below)
   */
  name: {
    type: String,
    required: [true, 'Folder name is required'],
    trim: true,         // Remove leading/trailing whitespace
    maxlength: [50, 'Folder name cannot exceed 50 characters']
  },

  /**
   * User reference - The user who owns this folder
   *
   * ObjectId reference to the User collection.
   * Used for:
   * - Ownership verification (users can only see/modify their own folders)
   * - Querying all folders for a user: Folder.find({ user: req.user._id })
   */
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',        // Reference to User model (enables populate())
    required: true      // Every folder must have an owner
  },

  /**
   * Creation timestamp
   * Automatically set when folder is created
   */
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ============================================================================
// INDEXES
// ============================================================================

/**
 * Compound Unique Index: (name, user)
 *
 * Ensures folder names are unique within a user's account.
 * This allows different users to have folders with the same name
 * while preventing duplicate folder names for a single user.
 *
 * Example:
 * - User A can have folder "Work"
 * - User B can also have folder "Work" (different user)
 * - User A CANNOT have two folders named "Work" (duplicate error)
 */
folderSchema.index({ name: 1, user: 1 }, { unique: true });

// ============================================================================
// MODEL EXPORT
// ============================================================================

/**
 * Folder Model
 *
 * Mongoose model for the 'folders' collection in MongoDB.
 * Use this to create, query, update, and delete folder documents.
 *
 * Common queries:
 * - Get all folders for user: Folder.find({ user: userId })
 * - Get folder by ID: Folder.findById(folderId)
 * - Check duplicate name: Folder.findOne({ name, user: userId })
 */
const Folder = mongoose.model('Folder', folderSchema);

module.exports = Folder;

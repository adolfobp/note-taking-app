/**
 * ============================================================================
 * APP.JS - Main Application Controller
 * ============================================================================
 *
 * The primary JavaScript file for the Note Taking App. Handles all user
 * interactions, state management, and coordinates with the backend API.
 *
 * APPLICATION ARCHITECTURE:
 * -------------------------
 *
 *   ┌─────────────────────────────────────────────────────────────────────────┐
 *   │                         Note Taking App                                 │
 *   │                                                                         │
 *   │   ┌──────────────┐   ┌────────────────┐   ┌────────────────────────┐   │
 *   │   │   Sidebar    │   │  Notes Panel   │   │    Editor Panel        │   │
 *   │   │              │   │                │   │                        │   │
 *   │   │ - All Notes  │   │ - Note List    │   │ - Title Input          │   │
 *   │   │ - Trash      │   │ - Search       │   │ - Quill Editor         │   │
 *   │   │ - Folders    │   │ - Date Groups  │   │ - Markdown Editor      │   │
 *   │   │              │   │                │   │ - Toolbar              │   │
 *   │   └──────────────┘   └────────────────┘   └────────────────────────┘   │
 *   │                                                                         │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *
 * FILE SECTIONS:
 * --------------
 * 1. Global State - Application state variables
 * 2. DOM Elements - Cached DOM references
 * 3. Initialization - App startup and editor setup
 * 4. Image Resize - In-editor image resizing
 * 5. Folder Operations - CRUD for folders
 * 6. Note Operations - CRUD for notes
 * 7. Editor Operations - Quill/Markdown editing
 * 8. AI Features - Title suggestion
 * 9. UI Helpers - Modals, escaping, embeds
 * 10. Event Listeners - User interaction handlers
 * 11. Drag and Drop - Note organization
 *
 * STATE MANAGEMENT:
 * -----------------
 * The app uses simple state variables at module scope:
 * - currentUser: Logged-in user data
 * - folders: Array of user's folders
 * - notes: Array of notes for current view
 * - currentFolder: 'all' | 'trash' | folderId
 * - currentNote: Currently selected note
 *
 * AUTO-SAVE:
 * ----------
 * Content changes trigger auto-save after 1 second of inactivity.
 * This is debounced via autoSaveTimeout to prevent excessive API calls.
 *
 * EDITORS:
 * --------
 * The app supports two editing modes:
 * - Normal: Quill rich text editor (default)
 * - Markdown: CodeMirror with markdown mode
 *
 * Users can toggle between views, with automatic conversion.
 *
 * KEYBOARD SHORTCUTS:
 * -------------------
 * - Ctrl/Cmd + S: Save current note
 * - Ctrl/Cmd + N: Create new note
 * - Escape: Close modals, deselect images
 *
 * RELATED FILES:
 * - api.js → API client and utilities
 * - ../app.html → Main application page
 * - ../css/styles.css → Application styles
 *
 * @module public/js/app
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the app
  initApp();
});

// ============================================================================
// GLOBAL STATE
// ============================================================================

/**
 * Currently authenticated user object
 * @type {Object|null}
 */
let currentUser = null;

/**
 * Array of user's folders with note counts
 * @type {Array<Object>}
 */
let folders = [];

/**
 * Array of notes for the current view (folder/trash/all)
 * @type {Array<Object>}
 */
let notes = [];

/**
 * Current folder selection: 'all', 'trash', or folder ID
 * @type {string}
 */
let currentFolder = 'all';

/**
 * Currently selected note for editing
 * @type {Object|null}
 */
let currentNote = null;

/**
 * Quill rich text editor instance
 * @type {Quill|null}
 */
let quillEditor = null;

/**
 * CodeMirror markdown editor instance
 * @type {CodeMirror|null}
 */
let markdownEditor = null;

/**
 * Timeout ID for debounced auto-save
 * @type {number|null}
 */
let autoSaveTimeout = null;

/**
 * Whether markdown view is currently active
 * @type {boolean}
 */
let isMarkdownView = false;

/**
 * Previous title stored for undo after AI generation
 * @type {string|null}
 */
let previousTitle = null;

// ============================================================================
// DOM ELEMENTS
// ============================================================================

/** Loading overlay shown during initialization */
const loadingOverlay = document.getElementById('loading-overlay');

/** Left sidebar containing folders */
const sidebar = document.getElementById('sidebar');

/** Middle panel containing note list */
const notesPanel = document.getElementById('notes-panel');

/** Right panel containing the editor */
const editorPanel = document.getElementById('editor-panel');

/** Container for folder list items */
const folderList = document.getElementById('folder-list');

/** Container for user-created folders */
const customFolders = document.getElementById('custom-folders');

/** Container for note cards */
const notesList = document.getElementById('notes-list');

/** Placeholder shown when no note is selected */
const editorPlaceholder = document.getElementById('editor-placeholder');

/** Container for the editor when a note is selected */
const editorContainer = document.getElementById('editor-container');

/** Input field for note title */
const noteTitleInput = document.getElementById('note-title');

/** Display element for note creation date */
const noteCreatedDate = document.getElementById('note-created-date');

/** Display element for note last updated date */
const noteUpdatedDate = document.getElementById('note-updated-date');

/** Badge showing current note's folder */
const noteFolderBadge = document.getElementById('note-folder-badge');

/** Container for Quill editor */
const editorContent = document.getElementById('editor-content');

/** Container for CodeMirror markdown editor */
const markdownView = document.getElementById('markdown-view');

/** Action buttons shown for trashed notes */
const trashActions = document.getElementById('trash-actions');

/** Search input field */
const searchInput = document.getElementById('search-input');

/** Title showing current folder name */
const currentFolderTitle = document.getElementById('current-folder-title');

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the Application
 *
 * Called on DOMContentLoaded. Performs:
 * 1. Authentication check (redirect if not logged in)
 * 2. Editor initialization (Quill and CodeMirror)
 * 3. Data loading (folders and notes)
 * 4. Event listener setup
 * 5. Hide loading overlay
 *
 * @async
 */
async function initApp() {
  try {
    // Check authentication
    const response = await authAPI.getCurrentUser();
    if (!response.user) {
      window.location.href = '/';
      return;
    }
    currentUser = response.user;

    // Initialize Quill editor
    initQuillEditor();

    // Initialize CodeMirror markdown editor
    initMarkdownEditor();

    // Load data
    await Promise.all([loadFolders(), loadNotes()]);

    // Setup event listeners
    setupEventListeners();

    // Hide loading
    loadingOverlay.classList.add('hidden');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    window.location.href = '/';
  }
}

/**
 * Initialize Quill Rich Text Editor
 *
 * Configures Quill with custom toolbar, image handling,
 * and auto-save on content changes.
 *
 * Toolbar includes: headers, formatting, lists, blockquote, links, images
 */
function initQuillEditor() {
  // Custom toolbar container with our buttons
  const toolbarOptions = {
    container: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote'],
      ['link', 'image'],
    ],
    handlers: {
      'image': imageHandler
    }
  };

  quillEditor = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Start writing...',
    modules: {
      toolbar: toolbarOptions,
    },
  });

  // Auto-save on content change
  quillEditor.on('text-change', () => {
    if (currentNote && !currentNote.isDeleted) {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(saveCurrentNote, 1000);
    }
  });

  // Setup image resize functionality
  setupImageResize();
}

/**
 * Initialize CodeMirror Markdown Editor
 *
 * Configures CodeMirror for markdown editing with:
 * - Markdown syntax highlighting
 * - Line numbers and wrapping
 * - Auto-save on content changes
 */
function initMarkdownEditor() {
  const textarea = document.getElementById('markdown-editor');
  markdownEditor = CodeMirror.fromTextArea(textarea, {
    mode: 'markdown',
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: true,
    autofocus: false,
    viewportMargin: Infinity,
    readOnly: false,
    inputStyle: 'contenteditable',
    spellcheck: true
  });

  // Auto-save on change
  markdownEditor.on('change', () => {
    if (currentNote && !currentNote.isDeleted) {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(saveCurrentNote, 1000);
    }
  });
}

// ============================================================================
// IMAGE RESIZE FUNCTIONALITY
// ============================================================================

/**
 * Image Resize State
 *
 * These variables track the currently selected image and its resize UI elements.
 */
let selectedImage = null;    // Currently selected image element
let resizeOverlay = null;    // Semi-transparent overlay on image
let resizeHandles = [];      // Corner drag handles
let sizeIndicator = null;    // Size display tooltip

/**
 * Setup Image Resize Handlers
 *
 * Enables click-to-select and drag-to-resize for images in the editor.
 * Creates visual overlay and corner handles for resizing.
 */
function setupImageResize() {
  const editor = document.querySelector('.ql-editor');

  // Click on image to select it
  editor.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      selectImage(e.target);
    } else {
      deselectImage();
    }
  });

  // Click outside editor to deselect
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ql-editor') && !e.target.closest('.resize-handle')) {
      deselectImage();
    }
  });

  // Keyboard to deselect
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      deselectImage();
    }
  });

  // Update overlay position on scroll
  document.querySelector('.ql-editor').addEventListener('scroll', updateOverlayPosition);
  window.addEventListener('resize', updateOverlayPosition);
}

/**
 * Select an Image for Resizing
 *
 * Creates visual overlay and drag handles around the image.
 * Deselects any previously selected image first.
 *
 * @param {HTMLImageElement} img - Image element to select
 */
function selectImage(img) {
  // Deselect previous
  deselectImage();

  selectedImage = img;
  selectedImage.classList.add('resizing');

  // Create overlay
  resizeOverlay = document.createElement('div');
  resizeOverlay.className = 'image-resize-overlay';
  document.body.appendChild(resizeOverlay);

  // Create resize handles
  const positions = ['nw', 'ne', 'sw', 'se'];
  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    handle.addEventListener('mousedown', (e) => startResize(e, pos));
    document.body.appendChild(handle);
    resizeHandles.push(handle);
  });

  // Create size indicator
  sizeIndicator = document.createElement('div');
  sizeIndicator.className = 'image-size-indicator';
  document.body.appendChild(sizeIndicator);

  // Position everything
  updateOverlayPosition();
}

/**
 * Update Resize Overlay Position
 *
 * Recalculates and applies positions for:
 * - Overlay rectangle (matches image bounds)
 * - Corner handles (at image corners)
 * - Size indicator (below image, centered)
 *
 * Called on scroll, window resize, and during drag.
 */
function updateOverlayPosition() {
  if (!selectedImage || !resizeOverlay) return;

  const rect = selectedImage.getBoundingClientRect();

  // Update overlay
  resizeOverlay.style.left = `${rect.left}px`;
  resizeOverlay.style.top = `${rect.top}px`;
  resizeOverlay.style.width = `${rect.width}px`;
  resizeOverlay.style.height = `${rect.height}px`;

  // Update handles
  const handleSize = 14;
  const halfHandle = handleSize / 2;

  resizeHandles.forEach(handle => {
    if (handle.classList.contains('nw')) {
      handle.style.left = `${rect.left - halfHandle}px`;
      handle.style.top = `${rect.top - halfHandle}px`;
    } else if (handle.classList.contains('ne')) {
      handle.style.left = `${rect.right - halfHandle}px`;
      handle.style.top = `${rect.top - halfHandle}px`;
    } else if (handle.classList.contains('sw')) {
      handle.style.left = `${rect.left - halfHandle}px`;
      handle.style.top = `${rect.bottom - halfHandle}px`;
    } else if (handle.classList.contains('se')) {
      handle.style.left = `${rect.right - halfHandle}px`;
      handle.style.top = `${rect.bottom - halfHandle}px`;
    }
  });

  // Update size indicator
  if (sizeIndicator) {
    sizeIndicator.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    sizeIndicator.style.left = `${rect.left + rect.width / 2}px`;
    sizeIndicator.style.top = `${rect.bottom + 8}px`;
    sizeIndicator.style.transform = 'translateX(-50%)';
  }
}

/**
 * Deselect Current Image
 *
 * Removes resize UI elements (overlay, handles, indicator).
 * Clears selectedImage state.
 */
function deselectImage() {
  if (selectedImage) {
    selectedImage.classList.remove('resizing');
    selectedImage = null;
  }

  if (resizeOverlay) {
    resizeOverlay.remove();
    resizeOverlay = null;
  }

  resizeHandles.forEach(handle => handle.remove());
  resizeHandles = [];

  if (sizeIndicator) {
    sizeIndicator.remove();
    sizeIndicator = null;
  }
}

/**
 * Start Image Resize Drag Operation
 *
 * Initiates mouse tracking for resizing:
 * - Calculates new dimensions based on drag delta
 * - Maintains aspect ratio
 * - Enforces min/max size limits
 * - Triggers auto-save on drag end
 *
 * @param {MouseEvent} e - Mousedown event
 * @param {string} handlePos - Handle position: 'nw', 'ne', 'sw', 'se'
 */
function startResize(e, handlePos) {
  e.preventDefault();
  e.stopPropagation();

  if (!selectedImage) return;

  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = selectedImage.offsetWidth;
  const startHeight = selectedImage.offsetHeight;
  const aspectRatio = startWidth / startHeight;

  function onMouseMove(e) {
    let deltaX = e.clientX - startX;
    let deltaY = e.clientY - startY;

    let newWidth, newHeight;

    // Calculate new dimensions based on handle position
    if (handlePos === 'se') {
      newWidth = startWidth + deltaX;
    } else if (handlePos === 'sw') {
      newWidth = startWidth - deltaX;
    } else if (handlePos === 'ne') {
      newWidth = startWidth + deltaX;
    } else if (handlePos === 'nw') {
      newWidth = startWidth - deltaX;
    }

    // Maintain aspect ratio
    newHeight = newWidth / aspectRatio;

    // Minimum size
    newWidth = Math.max(50, newWidth);
    newHeight = Math.max(50, newHeight);

    // Maximum size (container width)
    const maxWidth = document.querySelector('.ql-editor').clientWidth - 40;
    newWidth = Math.min(maxWidth, newWidth);
    newHeight = newWidth / aspectRatio;

    // Apply new size
    selectedImage.style.width = `${Math.round(newWidth)}px`;
    selectedImage.style.height = 'auto';

    // Update overlay position
    updateOverlayPosition();
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Trigger save
    if (currentNote && !currentNote.isDeleted) {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(saveCurrentNote, 500);
    }
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/**
 * Quill Image Handler
 *
 * Custom handler for the Quill toolbar image button.
 * Opens file picker, uploads to server, and embeds in editor.
 */
function imageHandler() {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/*');
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (file && currentNote) {
      try {
        // Upload the file
        const response = await notesAPI.uploadAttachments(currentNote._id, [file]);
        const attachment = response.attachments[0];

        // Insert into editor at cursor position
        const range = quillEditor.getSelection(true);
        quillEditor.insertEmbed(range.index, 'image', attachment.path);
        quillEditor.setSelection(range.index + 1);

        showToast('Image inserted', 'success');
      } catch (error) {
        showToast(error.message || 'Failed to upload image', 'error');
      }
    }
  };
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================

/**
 * Load All Folders from Server
 *
 * Fetches the user's folders and updates the sidebar.
 * Called during initialization and after folder CRUD operations.
 *
 * @async
 */
async function loadFolders() {
  try {
    const response = await foldersAPI.getAll();
    folders = response.folders;
    renderFolders();
  } catch (error) {
    console.error('Failed to load folders:', error);
    showToast('Failed to load folders', 'error');
  }
}

/**
 * Render Folders in Sidebar
 *
 * Creates folder list items with:
 * - Folder icon and name
 * - Note count badge
 * - Edit (rename) and delete action buttons
 * - Click handler to select folder
 * - Drag-and-drop support for note organization
 */
function renderFolders() {
  customFolders.innerHTML = '';

  folders.forEach(folder => {
    const li = document.createElement('li');
    li.className = `folder-item${currentFolder === folder._id ? ' active' : ''}`;
    li.dataset.folder = folder._id;
    li.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M2 4h14a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1z"/>
        <path d="M1 4l3-2h4l2 2" fill="none" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>${escapeHtml(folder.name)}</span>
      <span class="note-count">${folder.noteCount}</span>
      <div class="folder-actions">
        <button class="icon-btn edit-folder-btn" title="Rename">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10 2l2 2L5 11H3v-2L10 2z"/>
          </svg>
        </button>
        <button class="icon-btn danger delete-folder-btn" title="Delete">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 3l8 8M11 3l-8 8"/>
          </svg>
        </button>
      </div>
    `;

    li.addEventListener('click', (e) => {
      if (!e.target.closest('.folder-actions')) {
        selectFolder(folder._id);
      }
    });

    li.querySelector('.edit-folder-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      renameFolder(folder);
    });

    li.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFolder(folder);
    });

    customFolders.appendChild(li);
  });
}

// ============================================================================
// NOTE OPERATIONS
// ============================================================================

/**
 * Load Notes for Current Folder
 *
 * Fetches notes based on currentFolder state:
 * - 'all': All non-deleted notes
 * - 'trash': Deleted notes only
 * - folderId: Notes in specific folder
 *
 * Updates the notes panel title and triggers render.
 *
 * @async
 */
async function loadNotes() {
  try {
    let response;
    if (currentFolder === 'trash') {
      response = await notesAPI.getTrash();
      currentFolderTitle.textContent = 'Trash';
    } else if (currentFolder === 'all') {
      response = await notesAPI.getAll();
      currentFolderTitle.textContent = 'All Notes';
    } else {
      response = await notesAPI.getAll(currentFolder);
      const folder = folders.find(f => f._id === currentFolder);
      currentFolderTitle.textContent = folder ? folder.name : 'Notes';
    }
    notes = response.notes;
    renderNotes();
    updateNoteCounts();
  } catch (error) {
    console.error('Failed to load notes:', error);
    showToast('Failed to load notes', 'error');
  }
}

/**
 * Render Notes List
 *
 * Displays notes grouped by date (Today, Yesterday, This Week, etc.).
 * Supports search filtering by title and content.
 * Shows empty state when no notes match.
 *
 * @param {string} [searchQuery=''] - Optional search term to filter notes
 */
function renderNotes(searchQuery = '') {
  const filteredNotes = searchQuery
    ? notes.filter(note => {
        const title = note.title.toLowerCase();
        const content = stripHtml(note.content).toLowerCase();
        const query = searchQuery.toLowerCase();
        return title.includes(query) || content.includes(query);
      })
    : notes;

  if (filteredNotes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="8" y="6" width="32" height="36" rx="4"/>
          <path d="M16 16h16M16 24h12M16 32h8"/>
        </svg>
        <p>${currentFolder === 'trash' ? 'Trash is empty' : 'No notes yet'}</p>
      </div>
    `;
    return;
  }

  // Group notes by date
  const groups = {};
  filteredNotes.forEach(note => {
    const group = getDateGroup(note.updatedAt);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(note);
  });

  notesList.innerHTML = '';

  Object.entries(groups).forEach(([groupName, groupNotes]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'note-group';
    groupEl.innerHTML = `<div class="note-group-title">${groupName}</div>`;

    groupNotes.forEach(note => {
      const noteEl = document.createElement('div');
      noteEl.className = `note-card${currentNote && currentNote._id === note._id ? ' active' : ''}`;
      noteEl.dataset.id = note._id;

      const preview = stripHtml(note.content).substring(0, 50) || 'No content';

      noteEl.innerHTML = `
        <div class="note-card-title">${escapeHtml(note.title) || 'Untitled'}</div>
        <div class="note-card-meta">
          <span class="note-card-date">${formatDate(note.updatedAt)}</span>
          <span class="note-card-preview">${escapeHtml(preview)}</span>
        </div>
      `;

      noteEl.addEventListener('click', () => selectNote(note));
      groupEl.appendChild(noteEl);
    });

    notesList.appendChild(groupEl);
  });
}

/**
 * Update Note Counts in Sidebar
 *
 * Fetches fresh counts from server for:
 * - All Notes count
 * - Trash count
 *
 * Called after note create, delete, restore operations.
 *
 * @async
 */
async function updateNoteCounts() {
  try {
    // Always fetch actual counts from the server for accuracy
    const [allNotesResponse, trashResponse] = await Promise.all([
      notesAPI.getAll(),
      notesAPI.getTrash()
    ]);

    document.getElementById('all-notes-count').textContent = allNotesResponse.notes.length;
    document.getElementById('trash-count').textContent = trashResponse.notes.length;
  } catch (error) {
    console.error('Failed to update note counts:', error);
  }
}

/**
 * Select a Folder
 *
 * Changes the current folder view and reloads notes.
 * Updates sidebar active state and hides editor.
 *
 * @param {string} folderId - 'all', 'trash', or folder ObjectId
 */
function selectFolder(folderId) {
  currentFolder = folderId;
  currentNote = null;

  // Update active state in UI
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.folder === folderId);
  });

  // Hide editor
  editorContainer.style.display = 'none';
  editorPlaceholder.style.display = 'flex';

  // Load notes for folder
  loadNotes();

  // Mobile: show notes panel
  notesPanel.classList.remove('hidden');
  editorPanel.classList.remove('active');
}

/**
 * Select a Note for Editing
 *
 * Opens a note in the editor panel:
 * - Populates title, content, and metadata
 * - Shows/hides trash actions based on note state
 * - Resets markdown view to normal mode
 * - On mobile, shows the editor panel
 *
 * @param {Object} note - Note object to display
 */
async function selectNote(note) {
  currentNote = note;
  previousTitle = null; // Clear any stored title from previous note

  // Update active state in list
  document.querySelectorAll('.note-card').forEach(card => {
    card.classList.toggle('active', card.dataset.id === note._id);
  });

  // Show editor
  editorPlaceholder.style.display = 'none';
  editorContainer.style.display = 'flex';

  // Populate editor
  noteTitleInput.value = note.title || '';
  quillEditor.root.innerHTML = note.content || '';
  noteCreatedDate.textContent = formatFullDateTime(note.createdAt);
  noteUpdatedDate.textContent = formatFullDateTime(note.updatedAt);
  noteFolderBadge.textContent = note.folder?.name || 'No folder';

  // Show/hide trash actions
  if (note.isDeleted) {
    trashActions.style.display = 'flex';
    editorContent.style.display = 'none';
    noteTitleInput.disabled = true;
  } else {
    trashActions.style.display = 'none';
    editorContent.style.display = 'flex';
    noteTitleInput.disabled = false;
  }

  // Reset markdown view
  isMarkdownView = false;
  markdownView.style.display = 'none';
  editorContent.style.display = note.isDeleted ? 'none' : 'flex';

  // Reset toggle buttons
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === 'normal');
  });

  // Mobile: show editor panel
  editorPanel.classList.add('active');
}

/**
 * Save Current Note to Server
 *
 * Persists the current note's title and content.
 * Gets content from active editor (Quill or CodeMirror).
 * Called by auto-save timeout and manual save shortcuts.
 *
 * @async
 */
async function saveCurrentNote() {
  if (!currentNote || currentNote.isDeleted) return;

  try {
    const title = noteTitleInput.value.trim() || 'Untitled';

    // Get content from active editor
    let content;
    if (isMarkdownView && markdownEditor) {
      // Convert markdown to HTML before saving
      content = marked.parse(markdownEditor.getValue());
    } else {
      content = quillEditor.root.innerHTML;
    }

    const response = await notesAPI.update(currentNote._id, { title, content });
    currentNote = response.note;

    // Update note in list
    const noteIndex = notes.findIndex(n => n._id === currentNote._id);
    if (noteIndex !== -1) {
      notes[noteIndex] = currentNote;
    }

    // Re-render notes list
    renderNotes(searchInput.value);
  } catch (error) {
    console.error('Failed to save note:', error);
    showToast('Failed to save note', 'error');
  }
}

/**
 * Create a New Note
 *
 * Creates a blank note in the current folder (if applicable).
 * Adds note to list, selects it, and focuses title input.
 *
 * @async
 */
async function createNewNote() {
  try {
    const data = {};
    if (currentFolder !== 'all' && currentFolder !== 'trash') {
      data.folder = currentFolder;
    }

    const response = await notesAPI.create(data);
    notes.unshift(response.note);
    renderNotes();
    selectNote(response.note);
    noteTitleInput.focus();
    showToast('Note created', 'success');
  } catch (error) {
    console.error('Failed to create note:', error);
    showToast('Failed to create note', 'error');
  }
}

/**
 * Delete Current Note (Soft Delete)
 *
 * Moves the note to trash (sets isDeleted=true).
 * Removes from current list and hides editor.
 *
 * @async
 */
async function deleteNote() {
  if (!currentNote) return;

  try {
    await notesAPI.delete(currentNote._id);
    notes = notes.filter(n => n._id !== currentNote._id);
    currentNote = null;

    editorContainer.style.display = 'none';
    editorPlaceholder.style.display = 'flex';

    renderNotes();
    updateNoteCounts();
    showToast('Note moved to trash', 'success');

    // Mobile: go back to notes list
    editorPanel.classList.remove('active');
  } catch (error) {
    console.error('Failed to delete note:', error);
    showToast('Failed to delete note', 'error');
  }
}

/**
 * Restore Note from Trash
 *
 * Restores a deleted note (sets isDeleted=false).
 * Removes from trash view and updates counts.
 *
 * @async
 */
async function restoreNote() {
  if (!currentNote) return;

  try {
    const response = await notesAPI.restore(currentNote._id);
    notes = notes.filter(n => n._id !== currentNote._id);
    currentNote = null;

    editorContainer.style.display = 'none';
    editorPlaceholder.style.display = 'flex';

    renderNotes();
    updateNoteCounts();
    showToast('Note restored', 'success');
  } catch (error) {
    console.error('Failed to restore note:', error);
    showToast('Failed to restore note', 'error');
  }
}

/**
 * Permanently Delete Note
 *
 * Removes note from database permanently (irreversible).
 * Also deletes all associated attachment files.
 *
 * @async
 */
async function permanentlyDeleteNote() {
  if (!currentNote) return;

  try {
    await notesAPI.permanentDelete(currentNote._id);
    notes = notes.filter(n => n._id !== currentNote._id);
    currentNote = null;

    editorContainer.style.display = 'none';
    editorPlaceholder.style.display = 'flex';

    renderNotes();
    updateNoteCounts();
    showToast('Note permanently deleted', 'success');
  } catch (error) {
    console.error('Failed to delete note:', error);
    showToast('Failed to delete note', 'error');
  }
}

// ============================================================================
// EDITOR OPERATIONS
// ============================================================================

/**
 * Toggle Between Normal and Markdown View
 *
 * Switches between Quill (rich text) and CodeMirror (markdown) editors.
 * - To Markdown: Converts HTML to markdown syntax
 * - From Markdown: Parses markdown to HTML and saves
 *
 * Updates toggle button states to reflect current view.
 */
function toggleMarkdownView() {
  if (!currentNote || currentNote.isDeleted) return;

  if (!isMarkdownView) {
    // Switching TO markdown view
    let content = quillEditor.root.innerHTML;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Convert HTML to markdown syntax
    const markdownSource = htmlToMarkdown(tempDiv);

    // Set content in CodeMirror
    markdownEditor.setValue(markdownSource);

    markdownView.style.display = 'flex';
    editorContent.style.display = 'none';

    // Refresh CodeMirror after display change - needs longer delay for proper initialization
    setTimeout(() => {
      markdownEditor.refresh();
      markdownEditor.focus();
      // Set cursor at the end of content
      markdownEditor.setCursor(markdownEditor.lineCount(), 0);
    }, 50);
  } else {
    // Switching FROM markdown view - parse markdown to HTML
    const markdownText = markdownEditor.getValue();
    const html = marked.parse(markdownText);
    quillEditor.root.innerHTML = html;

    markdownView.style.display = 'none';
    editorContent.style.display = 'flex';

    // Trigger save after converting
    saveCurrentNote();
  }

  isMarkdownView = !isMarkdownView;

  // Update toggle button states
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === (isMarkdownView ? 'markdown' : 'normal'));
  });
}

/**
 * Convert HTML to Markdown
 *
 * Recursively converts HTML elements to markdown syntax.
 * Handles: headings, paragraphs, bold, italic, underline,
 * strikethrough, lists, blockquotes, code, links.
 *
 * @param {HTMLElement} element - DOM element to convert
 * @returns {string} Markdown formatted text
 */
function htmlToMarkdown(element) {
  let md = '';

  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Ignore whitespace-only text nodes (they often come from formatting/newlines)
      if (node.textContent && node.textContent.trim()) {
        md += node.textContent;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      switch (tag) {
        case 'h1':
          md += `# ${node.textContent}\n`;
          break;
        case 'h2':
          md += `## ${node.textContent}\n`;
          break;
        case 'h3':
          md += `### ${node.textContent}\n`;
          break;
        case 'p':
          {
            // Quill commonly inserts empty paragraphs (<p><br></p>) which create unwanted blank lines
            const paragraph = processInlineElements(node).replace(/\u00A0/g, ' ').trim();
            if (paragraph) {
              md += `${paragraph}\n`;
            }
          }
          break;
        case 'strong':
        case 'b':
          md += `**${node.textContent}**`;
          break;
        case 'em':
        case 'i':
          md += `*${node.textContent}*`;
          break;
        case 'u':
          md += `<u>${node.textContent}</u>`;
          break;
        case 's':
          md += `~~${node.textContent}~~`;
          break;
        case 'ul':
          node.querySelectorAll('li').forEach(li => {
            md += `- ${li.textContent}\n`;
          });
          break;
        case 'ol':
          let i = 1;
          node.querySelectorAll('li').forEach(li => {
            md += `${i++}. ${li.textContent}\n`;
          });
          break;
        case 'blockquote':
          {
            const quote = (node.textContent || '').replace(/\u00A0/g, ' ').trim();
            if (quote) {
              md += `> ${quote}\n`;
            }
          }
          break;
        case 'pre':
          md += `\`\`\`\n${node.textContent}\n\`\`\`\n`;
          break;
        case 'code':
          md += `\`${node.textContent}\``;
          break;
        case 'a':
          md += `[${node.textContent}](${node.href})`;
          break;
        case 'br':
          md += '\n';
          break;
        default:
          md += htmlToMarkdown(node);
      }
    }
  });

  return md;
}

/**
 * Process Inline Formatting Elements
 *
 * Converts inline HTML elements (bold, italic, etc.) within
 * a paragraph to their markdown equivalents.
 *
 * @param {HTMLElement} element - Parent element containing inline elements
 * @returns {string} Text with inline markdown formatting
 */
function processInlineElements(element) {
  let result = '';
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      switch (tag) {
        case 'strong':
        case 'b':
          result += `**${node.textContent}**`;
          break;
        case 'em':
        case 'i':
          result += `*${node.textContent}*`;
          break;
        case 'u':
          result += `<u>${node.textContent}</u>`;
          break;
        case 's':
          result += `~~${node.textContent}~~`;
          break;
        case 'code':
          result += `\`${node.textContent}\``;
          break;
        case 'a':
          result += `[${node.textContent}](${node.href})`;
          break;
        default:
          result += node.textContent;
      }
    }
  });
  return result;
}

// ============================================================================
// AI FEATURES
// ============================================================================

/**
 * Suggest Title Using AI
 *
 * Calls Claude API to generate a title based on note content.
 * Saves previous title for undo functionality.
 *
 * Prerequisites:
 * - Note must be selected
 * - Content must not be empty
 * - CLAUDE_API_KEY must be configured on server
 *
 * @async
 */
async function suggestTitle() {
  if (!currentNote || !quillEditor.getText().trim()) {
    showToast('Add some content first', 'warning');
    return;
  }

  const btn = document.getElementById('ai-title-btn');
  btn.disabled = true;

  try {
    const content = quillEditor.root.innerHTML;
    const response = await aiAPI.suggestTitle(content);

    // Save current title for undo functionality
    previousTitle = noteTitleInput.value;

    noteTitleInput.value = response.title;
    await saveCurrentNote();
    showToast('Title generated - click Undo to revert', 'success');
  } catch (error) {
    console.error('AI title suggestion failed:', error);
    // Provide user-friendly error messages
    if (error.code === 'SERVICE_UNAVAILABLE') {
      showToast('AI service not configured. Add CLAUDE_API_KEY to .env file.', 'error');
    } else {
      showToast(error.message || 'Failed to generate title', 'error');
    }
  } finally {
    btn.disabled = false;
  }
}

// ============================================================================
// FOLDER CRUD OPERATIONS
// ============================================================================

/**
 * Create a New Folder
 *
 * Creates a folder with the given name and updates sidebar.
 *
 * @async
 * @param {string} name - Folder name (must be unique for user)
 */
async function createFolder(name) {
  try {
    const response = await foldersAPI.create(name);
    folders.push(response.folder);
    renderFolders();
    showToast('Folder created', 'success');
  } catch (error) {
    console.error('Failed to create folder:', error);
    showToast(error.message || 'Failed to create folder', 'error');
  }
}

/**
 * Rename a Folder
 *
 * Prompts user for new name and updates folder.
 * No-op if user cancels or enters same name.
 *
 * @async
 * @param {Object} folder - Folder object with _id and name
 */
async function renameFolder(folder) {
  const newName = prompt('Enter new folder name:', folder.name);
  if (!newName || newName === folder.name) return;

  try {
    const response = await foldersAPI.update(folder._id, newName);
    const index = folders.findIndex(f => f._id === folder._id);
    if (index !== -1) {
      folders[index] = response.folder;
    }
    renderFolders();
    showToast('Folder renamed', 'success');
  } catch (error) {
    console.error('Failed to rename folder:', error);
    showToast(error.message || 'Failed to rename folder', 'error');
  }
}

/**
 * Delete a Folder
 *
 * Removes folder after user confirmation.
 * Notes in folder are orphaned (moved to "All Notes"), not deleted.
 * If deleted folder was selected, switches to "All Notes".
 *
 * @async
 * @param {Object} folder - Folder object with _id and name
 */
async function deleteFolder(folder) {
  if (!confirm(`Delete folder "${folder.name}"? Notes will be moved to "All Notes".`)) {
    return;
  }

  try {
    await foldersAPI.delete(folder._id);
    folders = folders.filter(f => f._id !== folder._id);

    if (currentFolder === folder._id) {
      selectFolder('all');
    } else {
      renderFolders();
    }

    showToast('Folder deleted', 'success');
  } catch (error) {
    console.error('Failed to delete folder:', error);
    showToast(error.message || 'Failed to delete folder', 'error');
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Open a Modal Dialog
 *
 * @param {string} modalId - DOM ID of the modal element
 */
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

/**
 * Close a Modal Dialog
 *
 * @param {string} modalId - DOM ID of the modal element
 */
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

/**
 * Show Confirmation Modal
 *
 * Displays a modal with title, message, and OK/Cancel buttons.
 * Executes callback when user clicks OK.
 *
 * @param {string} title - Modal header text
 * @param {string} message - Modal body text
 * @param {Function} onConfirm - Callback executed on confirmation
 */
function showConfirmModal(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;

  const confirmBtn = document.getElementById('confirm-ok');
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', () => {
    onConfirm();
    closeModal('confirm-modal');
  });

  openModal('confirm-modal');
}

/**
 * Log Out Current User
 *
 * Ends session and redirects to login page.
 * Redirects even if logout API call fails.
 *
 * @async
 */
async function logout() {
  try {
    await authAPI.logout();
    window.location.href = '/';
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect anyway
    window.location.href = '/';
  }
}

/**
 * Escape HTML Special Characters
 *
 * Prevents XSS by escaping <, >, &, ", ' characters.
 * Uses browser's built-in textContent encoding.
 *
 * @param {string} text - Untrusted text to escape
 * @returns {string} Safely escaped HTML string
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Process Embeddable Content URLs
 *
 * Detects and converts supported URLs to embedded content:
 * - YouTube: Converts watch URLs to iframe embeds
 * - Instagram: Converts post URLs to links
 *
 * @param {string} content - HTML content to process
 * @returns {string} Content with embedded media
 */
function processEmbeds(content) {
  // YouTube embed detection
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  content = content.replace(youtubeRegex, (match, videoId) => {
    return `<div class="embed-container"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
  });

  // Instagram embed detection (simplified - shows as link/image placeholder)
  const instaRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/g;
  content = content.replace(instaRegex, (match, postId) => {
    return `<div class="instagram-embed"><a href="https://www.instagram.com/p/${postId}" target="_blank">View Instagram Post</a></div>`;
  });

  return content;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Setup All Event Listeners
 *
 * Attaches handlers for:
 * - Folder selection (sidebar items)
 * - Note operations (create, delete, restore)
 * - Editor controls (title, save, undo/redo)
 * - View toggle (normal/markdown)
 * - Search input
 * - Modal interactions
 * - Panel collapse/expand
 * - Mobile navigation
 * - Keyboard shortcuts (Ctrl+S, Ctrl+N, Escape)
 * - Drag and drop initialization
 */
function setupEventListeners() {
  // Folder selection (All Notes, Trash)
  folderList.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => selectFolder(item.dataset.folder));
  });

  // New note button (header button)
  document.getElementById('new-note-header-btn').addEventListener('click', createNewNote);

  // Note title save
  noteTitleInput.addEventListener('blur', saveCurrentNote);
  noteTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      quillEditor.focus();
    }
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    renderNotes(e.target.value);
  });

  // Delete note button
  document.getElementById('delete-note-btn').addEventListener('click', () => {
    showConfirmModal('Delete Note', 'Move this note to trash?', deleteNote);
  });

  // Restore note button
  document.getElementById('restore-note-btn').addEventListener('click', restoreNote);

  // Permanent delete button
  document.getElementById('permanent-delete-btn').addEventListener('click', () => {
    showConfirmModal('Delete Permanently', 'This cannot be undone.', permanentlyDeleteNote);
  });

  // AI title button
  document.getElementById('ai-title-btn').addEventListener('click', suggestTitle);

  // Undo/Redo buttons
  document.getElementById('undo-btn').addEventListener('click', async () => {
    // First check if there's a title to undo (from AI generation)
    if (previousTitle !== null) {
      noteTitleInput.value = previousTitle;
      previousTitle = null; // Clear after restoring
      await saveCurrentNote();
      showToast('Title restored', 'success');
      return;
    }
    // Otherwise, use Quill's undo for editor content
    if (quillEditor) {
      quillEditor.history.undo();
    }
  });

  document.getElementById('redo-btn').addEventListener('click', () => {
    if (quillEditor) {
      quillEditor.history.redo();
    }
  });

  // View toggle (Normal/Markdown)
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'markdown' && !isMarkdownView) {
        toggleMarkdownView();
      } else if (view === 'normal' && isMarkdownView) {
        toggleMarkdownView();
      }
    });
  });

  // New folder button
  document.getElementById('new-folder-btn').addEventListener('click', () => {
    document.getElementById('new-folder-name').value = '';
    openModal('new-folder-modal');
  });

  // New folder modal
  document.getElementById('new-folder-save').addEventListener('click', () => {
    const name = document.getElementById('new-folder-name').value.trim();
    if (name) {
      createFolder(name);
      closeModal('new-folder-modal');
    }
  });

  document.getElementById('new-folder-cancel').addEventListener('click', () => {
    closeModal('new-folder-modal');
  });

  document.getElementById('new-folder-close').addEventListener('click', () => {
    closeModal('new-folder-modal');
  });

  // Confirm modal
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    closeModal('confirm-modal');
  });

  document.getElementById('confirm-close').addEventListener('click', () => {
    closeModal('confirm-modal');
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      backdrop.closest('.modal').classList.remove('active');
    });
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Collapse/Expand sidebar
  const appContainer = document.querySelector('.app-container');

  document.getElementById('collapse-sidebar-btn').addEventListener('click', () => {
    appContainer.classList.add('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', 'true');
  });

  document.getElementById('expand-sidebar-btn').addEventListener('click', () => {
    appContainer.classList.remove('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', 'false');
    // If notes is also collapsed, expand it too
    if (appContainer.classList.contains('notes-collapsed')) {
      appContainer.classList.remove('notes-collapsed');
      localStorage.setItem('notesCollapsed', 'false');
    }
  });

  // Collapse/Expand notes panel (also collapses sidebar)
  document.getElementById('collapse-notes-btn').addEventListener('click', () => {
    appContainer.classList.add('notes-collapsed');
    appContainer.classList.add('sidebar-collapsed');
    localStorage.setItem('notesCollapsed', 'true');
    localStorage.setItem('sidebarCollapsed', 'true');
  });

  document.getElementById('expand-notes-btn').addEventListener('click', () => {
    appContainer.classList.remove('notes-collapsed');
    localStorage.setItem('notesCollapsed', 'false');
  });

  // Restore collapsed state from localStorage
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    appContainer.classList.add('sidebar-collapsed');
  }
  if (localStorage.getItem('notesCollapsed') === 'true') {
    appContainer.classList.add('notes-collapsed');
  }

  // Mobile: sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Mobile: back to notes list
  document.getElementById('notes-list-toggle').addEventListener('click', () => {
    editorPanel.classList.remove('active');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentNote();
    }

    // Ctrl/Cmd + N for new note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewNote();
    }

    // Escape to close modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
      });
    }
  });

  // Setup drag and drop
  setupDragAndDrop();
}

// ============================================================================
// DRAG AND DROP
// ============================================================================

/**
 * Currently dragged note ID
 * @type {string|null}
 */
let draggedNote = null;

/**
 * Initialize Drag and Drop for Note Organization
 *
 * Makes folder items droppable targets for note cards.
 * Allows users to drag notes between folders.
 */
function setupDragAndDrop() {
  // Make folder items droppable
  const allFolderItems = document.querySelectorAll('.folder-item');
  allFolderItems.forEach(folderItem => {
    setupFolderDropZone(folderItem);
  });
}

/**
 * Configure a Folder as a Drop Zone
 *
 * Adds drag event handlers to a folder list item:
 * - dragover: Highlight as valid drop target
 * - dragleave: Remove highlight
 * - drop: Move note to folder
 *
 * @param {HTMLElement} folderItem - Folder list item element
 */
function setupFolderDropZone(folderItem) {
  folderItem.addEventListener('dragover', (e) => {
    e.preventDefault();
    folderItem.classList.add('drag-over');
  });

  folderItem.addEventListener('dragleave', () => {
    folderItem.classList.remove('drag-over');
  });

  folderItem.addEventListener('drop', async (e) => {
    e.preventDefault();
    folderItem.classList.remove('drag-over');

    if (draggedNote) {
      const targetFolderId = folderItem.dataset.folder;

      // Don't allow dropping on trash
      if (targetFolderId === 'trash') {
        showToast('Cannot drop notes directly to trash', 'warning');
        return;
      }

      // Move the note
      const folderId = targetFolderId === 'all' ? null : targetFolderId;
      await moveNoteToDraggedFolder(draggedNote, folderId);
      draggedNote = null;
    }
  });
}

/**
 * Move Note to Target Folder
 *
 * Updates note's folder assignment via API.
 * Refreshes folder counts and note list after move.
 *
 * @async
 * @param {string} noteId - ID of note to move
 * @param {string|null} folderId - Target folder ID (null for "All Notes")
 */
async function moveNoteToDraggedFolder(noteId, folderId) {
  try {
    const response = await notesAPI.update(noteId, {
      folder: folderId || null,
    });

    // Update the local notes array
    const noteIndex = notes.findIndex(n => n._id === noteId);
    if (noteIndex !== -1) {
      notes[noteIndex] = response.note;
    }

    // Refresh folders and notes
    await loadFolders();
    await loadNotes();
    showToast('Note moved', 'success');
  } catch (error) {
    console.error('Failed to move note:', error);
    showToast(error.message || 'Failed to move note', 'error');
  }
}

// ============================================================================
// RENDER FUNCTION ENHANCEMENTS
// ============================================================================

/**
 * Enhanced Render Notes with Drag Support
 *
 * Wraps original renderNotes to add drag capabilities:
 * - Makes note cards draggable
 * - Tracks draggedNote on dragstart
 * - Clears drag state on dragend
 */
const originalRenderNotes = renderNotes;
renderNotes = function(searchQuery = '') {
  originalRenderNotes(searchQuery);

  // Add drag capability to note cards
  document.querySelectorAll('.note-card').forEach(noteCard => {
    noteCard.draggable = true;

    noteCard.addEventListener('dragstart', (e) => {
      draggedNote = noteCard.dataset.id;
      noteCard.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    noteCard.addEventListener('dragend', () => {
      noteCard.classList.remove('dragging');
      document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('drag-over'));
    });
  });
};

/**
 * Enhanced Render Folders with Drop Zone Setup
 *
 * Wraps original renderFolders to configure drop zones
 * on newly rendered folder items for drag-and-drop support.
 */
const originalRenderFolders = renderFolders;
renderFolders = function() {
  originalRenderFolders();

  // Setup drop zones for custom folders
  document.querySelectorAll('#custom-folders .folder-item').forEach(folderItem => {
    setupFolderDropZone(folderItem);
  });
};

# Note-Taking App

A full-stack note-taking application inspired by Apple Notes, built with the MERN stack (MongoDB, Express.js, HTML/CSS/Vanilla JS, Node.js).

## Features

### 🔐 Account & Security
- **User registration** with username, email, and password
- **Secure login/logout** with session-based authentication
- **Private notes** — each user can only access their own notes
- **Form validation** with real-time error feedback
- **Automatic redirect** to app when already logged in

### 📝 Note Management
- **Create, edit, and delete notes** with instant feedback
- **Auto-save** — changes are saved automatically as you type (1-second debounce)
- **Soft delete** — deleted notes go to Trash for 30-day recovery
- **Restore notes** from Trash with one click
- **Permanent delete** option for Trash items
- **Note timestamps** — see when each note was created and last modified

### 📁 Organization
- **Custom folders** — create, rename, and delete folders
- **Drag and drop** — move notes between folders by dragging
- **All Notes view** — see every note across all folders
- **Trash folder** — dedicated view for deleted notes
- **Smart date grouping** — notes organized by Today, Yesterday, Previous 7 Days, Previous 30 Days, and older
- **Note counts** — folder badges show how many notes are inside
- **Search** — filter notes by title or content in real-time

### ✍️ Rich Text Editing
- **Quill.js editor** with formatting toolbar
- **Text formatting** — bold, italic, underline, strikethrough
- **Headers** — H1, H2, H3 hierarchy
- **Lists** — ordered (numbered) and unordered (bullet) lists
- **Blockquotes** for callouts and citations
- **Code blocks** with syntax preservation
- **Links** — insert and edit hyperlinks
- **Inline images** — insert images directly into note content

### 🖼️ Media & Attachments
- **Image upload** — attach images via toolbar button
- **Inline image resizing** — drag corner handles to resize images
- **Size indicator** — shows pixel dimensions while resizing
- **Video upload support** — attach video files to notes
- **YouTube embedding** — paste YouTube URLs for automatic embed detection
- **Instagram embedding** — paste Instagram post URLs for link previews

### 📄 Markdown Mode
- **Toggle between Normal and Markdown views**
- **CodeMirror editor** with Material Darker theme
- **Syntax highlighting** for markdown formatting
- **Line numbers** for easy reference
- **Two-way sync** — edits in either view update the note
- **Automatic conversion** — HTML to Markdown and back

### 🤖 AI Features
- **AI title suggestions** — generate titles from note content using Claude API
- **Undo AI title** — restore previous title if you don't like the suggestion

### 🎨 User Interface
- **Apple Notes-inspired design** — clean and minimalist
- **Three-panel layout** — Folders sidebar, Notes list, Note editor
- **Collapsible panels** — hide Folders and/or Notes list to focus on writing
- **Panel memory** — collapsed states persist across sessions (localStorage)
- **Smart panel behavior** — collapsing Notes also collapses Folders; expanding Folders also expands Notes
- **Loading states** — spinners and button states during async operations
- **Toast notifications** — success, warning, and error messages
- **Confirmation modals** — prevent accidental deletions

### 📱 Responsive Design
- **Mobile-friendly** — works on phones and tablets
- **Adaptive layout** — panels stack vertically on small screens
- **Touch-friendly** — buttons and controls sized for touch input
- **Mobile navigation** — hamburger menu and back buttons

### ⌨️ Keyboard Shortcuts
- **Ctrl/Cmd + S** — save current note
- **Ctrl/Cmd + N** — create new note
- **Escape** — close modals, deselect images

### 🔧 Developer Experience
- **RESTful API** — clean endpoints for all operations
- **Comprehensive error handling** — user-friendly error messages
- **MVC architecture** — organized codebase with separation of concerns
- **Environment configuration** — easy setup with `.env` file

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js 5.x** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **Passport.js** - Authentication middleware
- **express-session** - Session management
- **Multer** - File upload handling
- **dotenv** - Environment variable management

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling (Flexbox, Grid, CSS Variables)
- **Vanilla JavaScript** - Interactivity
- **Quill.js** - Rich text editor (CDN)
- **CodeMirror 5** - Markdown editor with syntax highlighting (CDN)
- **marked.js** - Markdown parser (CDN)
- **highlight.js** - Code syntax highlighting (CDN)

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- MongoDB 6.x or higher (running locally or MongoDB Atlas)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Note_taking_app
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
touch .env
```

4. Configure environment variables in `.env`:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/note_taking_app
SESSION_SECRET=your-secret-key-here
CLAUDE_API_KEY=your-claude-api-key  # Optional, for AI title suggestions
```

5. Start MongoDB (if running locally):
```bash
mongod
```

6. Start the development server:
```bash
npm run dev
```

7. Open your browser and navigate to:
```
http://localhost:3000
```

### Production

For production deployment:
```bash
npm start
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |

### Folders (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | Get all folders |
| POST | `/api/folders` | Create folder |
| PUT | `/api/folders/:id` | Update folder |
| DELETE | `/api/folders/:id` | Delete folder |

### Notes (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | Get all notes (optional: `?folder=id`) |
| GET | `/api/notes/trash` | Get deleted notes |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Soft delete (move to trash) |
| POST | `/api/notes/:id/restore` | Restore from trash |
| DELETE | `/api/notes/:id/permanent` | Permanently delete |

### Attachments (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notes/:id/attachments` | Upload files |
| DELETE | `/api/notes/:noteId/attachments/:attachmentId` | Delete attachment |

### AI (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/suggest-title` | Generate title from content |

## Project Structure

```
Note_taking_app/
├── server/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── passport.js        # Passport configuration
│   ├── controllers/
│   │   ├── authController.js  # Auth logic
│   │   ├── folderController.js
│   │   ├── noteController.js
│   │   └── aiController.js
│   ├── middleware/
│   │   ├── auth.js            # Auth middleware
│   │   ├── upload.js          # Multer config
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Folder.js
│   │   └── Note.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── folderRoutes.js
│   │   ├── noteRoutes.js
│   │   └── aiRoutes.js
│   ├── uploads/               # Uploaded files
│   └── server.js              # Entry point
├── public/
│   ├── css/
│   │   ├── styles.css         # Global styles
│   │   ├── auth.css           # Login/register styles
│   │   └── app.css            # Main app styles
│   ├── js/
│   │   ├── api.js             # API helper functions
│   │   ├── auth.js            # Login/register logic
│   │   └── app.js             # Main app logic
│   ├── index.html             # Login/register page
│   └── app.html               # Main application
├── .gitignore
├── package.json
├── PROJECT_PLAN.md
└── README.md
```

## Keyboard Shortcuts

- `Ctrl/Cmd + S` - Save current note
- `Ctrl/Cmd + N` - Create new note
- `Escape` - Close modals / Deselect image

## Panel Controls

- **Collapse Folders** - Click the `◀` button in the Folders header
- **Collapse Notes** - Click the `◀` button in the Notes header (also collapses Folders)
- **Expand Folders** - Click the `▶` button in the collapsed gutter (also expands Notes)
- **Expand Notes** - Click the `▶` button in the collapsed gutter

## Development Reflection

### The Development Journey

This project was my most ambitious undertaking in the bootcamp so far. When I first read the requirements, I felt both excited and overwhelmed—building a full-stack application from scratch seemed like a massive leap from the individual concepts we'd learned in class. The PROJECT_PLAN.md became my compass throughout development. Writing detailed Architecture Decision Records (ADRs) before coding helped me avoid decision paralysis later. For example, choosing Passport.js with session-based authentication over JWT wasn't arbitrary; it aligned with what we'd learned in Lesson 12 and avoided introducing new concepts mid-project.

### Challenges Faced

The biggest challenge was integrating the rich text editor. Quill.js seemed straightforward at first, but syncing its HTML output with a CodeMirror markdown editor required understanding both libraries deeply. Converting HTML to Markdown and back without losing formatting took several iterations. I learned to read documentation more carefully and test edge cases—like what happens when a user pastes formatted text from Word or types code blocks.

File uploads with Multer presented unexpected hurdles. I initially struggled with understanding how multipart form data works and why my files weren't saving. The solution involved properly configuring the storage engine with UUID filenames to prevent collisions. Implementing inline image resizing pushed me further—I had to manipulate the DOM directly within Quill's editor container, adding resize handles and calculating dimensions on mouse drag events.

The three-panel responsive layout was another significant challenge. Making the sidebar, notes list, and editor work seamlessly on both desktop and mobile required careful CSS Grid planning. Implementing collapsible panels with smooth animations while maintaining state across page refreshes (using localStorage) taught me the importance of thinking about user experience beyond basic functionality.

Drag-and-drop functionality for moving notes between folders seemed simple conceptually but required handling multiple edge cases: What if a user drops a note on the same folder? What about the trash folder? What visual feedback should indicate a valid drop target? Each question led to more code and more testing.

### Lessons Learned

Perhaps the most valuable lesson was the importance of planning before coding. The detailed PROJECT_PLAN.md saved me countless hours of refactoring. When I knew exactly which endpoints I needed, which models to create, and how the frontend would interact with the backend, implementation became almost mechanical—just following the blueprint.

Error handling transformed from an afterthought to a priority. Early in development, I'd get cryptic errors and spend hours debugging. Once I implemented the centralized error handler middleware with clear error codes and messages, debugging became faster and the user experience improved dramatically. Users now see helpful toast notifications instead of blank screens.

The MVC (Model-View-Controller) pattern proved its worth in maintainability. When I needed to add the AI title suggestion feature late in development, I simply created a new controller and route without touching existing code. This separation of concerns made the codebase feel organized rather than chaotic.

Working with async/await and Promises deepened considerably. I encountered race conditions when auto-saving notes while the user was still typing, which taught me about debouncing. Understanding the event loop and how MongoDB operations are non-blocking helped me write more efficient code.

### Technical Decisions Worth Noting

Storing note content as HTML rather than Quill's Delta format was a pragmatic choice. While Delta is more structured, HTML is directly renderable and easier to convert to Markdown. This tradeoff prioritized simplicity over theoretical purity.

Using local file storage instead of cloud services (like AWS S3) kept the project focused on core requirements. For a production app, I'd definitely migrate to cloud storage, but for this bootcamp project, the `/uploads` directory with proper `.gitignore` rules worked perfectly.

The soft-delete pattern for notes (using `isDeleted` and `deletedAt` fields) was inspired by how production applications handle deletion. Users can recover notes within 30 days, which provides a safety net against accidental deletions.

### Future Improvements

If I were to continue developing this application, real-time collaboration would be my first priority. Implementing WebSockets to sync notes between multiple users editing simultaneously would be a fascinating challenge. I'd also add full-text search using MongoDB's text indexes, note sharing with permission levels, and export functionality for PDF and Markdown formats. A mobile app using React Native could extend the experience to phones, and implementing service workers would enable offline access—a feature I've come to appreciate in the apps I use daily.

### Final Thoughts

This project transformed how I think about software development. It's not just about making things work; it's about making things work well—for users, for future developers reading the code, and for the codebase as it grows. I'm proud of what I've built and excited to apply these lessons to future projects.

## License

ISC

## Author

Bootcamp Student - Mid-term Project

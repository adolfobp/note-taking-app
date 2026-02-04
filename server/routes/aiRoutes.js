/**
 * ============================================================================
 * AIROUTES.JS - AI-Powered Features API Routes
 * ============================================================================
 *
 * Defines the Express routes for AI-powered functionality.
 * All routes are prefixed with /api/ai (configured in server.js).
 *
 * ROUTE OVERVIEW:
 * ---------------
 *
 *   METHOD   ENDPOINT                 CONTROLLER
 *   ──────   ────────                 ──────────
 *   POST     /api/ai/suggest-title    suggestTitle
 *
 * AUTHENTICATION:
 * ---------------
 * All routes require authentication via router.use(isAuthenticated).
 * AI features are only available to logged-in users.
 *
 * CURRENT FEATURES:
 * -----------------
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  AI Title Suggestion                                              │
 *   │                                                                   │
 *   │  Frontend sends note content → Claude API generates title        │
 *   │                                                                   │
 *   │  ┌─────────────────────────────────────────────────────────────┐  │
 *   │  │  Note Editor                                                │  │
 *   │  │  ┌─────────────────────────────────────────────────────────┐ │  │
 *   │  │  │ Title: [Meeting Notes    ] [✨ Suggest Title]           │ │  │
 *   │  │  └─────────────────────────────────────────────────────────┘ │  │
 *   │  │                                                             │  │
 *   │  │  User clicks "Suggest Title" → POST /api/ai/suggest-title   │  │
 *   │  │  Response: { title: "Q4 Planning Meeting Notes" }           │  │
 *   │  └─────────────────────────────────────────────────────────────┘  │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * POTENTIAL FUTURE AI FEATURES:
 * -----------------------------
 * This route file can be extended with additional AI features:
 * - POST /api/ai/summarize → Summarize long notes
 * - POST /api/ai/generate-tags → Auto-generate note tags
 * - POST /api/ai/improve-writing → Grammar/style suggestions
 * - POST /api/ai/translate → Translate note content
 *
 * RELATED FILES:
 * - ../controllers/aiController.js → Route handlers
 * - ../middleware/auth.js → isAuthenticated middleware
 * - ../../public/js/app.js → "Suggest Title" button handler
 * - ../../public/js/api.js → api.ai.suggestTitle() method
 *
 * @module routes/aiRoutes
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { isAuthenticated } = require('../middleware/auth');

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Apply isAuthenticated to ALL AI routes.
 * AI features require user to be logged in.
 */
router.use(isAuthenticated);

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * POST /api/ai/suggest-title
 *
 * Generate an AI-suggested title based on note content.
 * Uses Claude API (claude-3-haiku) to analyze content and generate
 * a concise, relevant title (max 8 words).
 *
 * Controller: aiController.suggestTitle
 *
 * Request body: { content: "<html content from Quill editor>" }
 * Response: { title: "Suggested Title Here" }
 *
 * Errors:
 * - 400: Content is required
 * - 502: Claude API error
 * - 503: CLAUDE_API_KEY not configured
 */
router.post('/suggest-title', aiController.suggestTitle);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;

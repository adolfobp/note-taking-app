/**
 * ============================================================================
 * AICONTROLLER.JS - AI-Powered Features
 * ============================================================================
 *
 * Handles AI-powered functionality using the Claude API from Anthropic.
 * Currently provides automatic title generation for notes.
 *
 * AI FEATURE: TITLE SUGGESTION
 * ----------------------------
 *
 * FLOW:
 * 1. Frontend sends note content (HTML from Quill editor)
 * 2. Controller strips HTML tags to get plain text
 * 3. Content is truncated to 2000 chars (API efficiency)
 * 4. Claude API generates a concise title (max 8 words)
 * 5. Title is returned to frontend
 *
 * API CONFIGURATION:
 * ------------------
 * - Provider: Anthropic Claude API
 * - Model: claude-3-haiku-20240307 (fast, cost-effective)
 * - Max tokens: 50 (titles are short)
 * - API key: process.env.CLAUDE_API_KEY
 *
 * ERROR HANDLING:
 * ---------------
 * - 400: Content is missing or empty
 * - 502: Claude API returned an error
 * - 503: CLAUDE_API_KEY not configured
 *
 * SECURITY:
 * ---------
 * - API key stored in environment variable (never in code)
 * - User content is processed but not stored by AI
 * - Request is authenticated (user must be logged in)
 *
 * USAGE IN FRONTEND:
 * ------------------
 * The "Suggest Title" button in the editor calls this endpoint:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Note Editor                                        │
 *   │  ┌───────────────────────────────────────────────┐  │
 *   │  │ Title: [          ] [✨ Suggest Title]        │  │
 *   │  └───────────────────────────────────────────────┘  │
 *   │  ┌───────────────────────────────────────────────┐  │
 *   │  │ Content...                                    │  │
 *   │  └───────────────────────────────────────────────┘  │
 *   └─────────────────────────────────────────────────────┘
 *
 * RELATED FILES:
 * - ../routes/aiRoutes.js → Route definitions
 * - ../middleware/auth.js → isAuthenticated middleware
 * - ../../public/js/app.js → Frontend button handler
 * - ../../public/js/api.js → api.ai.suggestTitle() function
 *
 * @module controllers/aiController
 */

// ============================================================================
// SUGGEST TITLE
// ============================================================================

/**
 * Generate AI-Suggested Title for Note Content
 *
 * Uses Claude API to analyze note content and generate a concise,
 * relevant title. The title is typically 3-8 words.
 *
 * @route POST /api/ai/suggest-title
 * @access Protected (isAuthenticated)
 *
 * @param {Object} req.body
 * @param {string} req.body.content - HTML content from Quill editor
 *
 * @returns {Object} 200 - { title: "Suggested title here" }
 * @returns {Object} 400 - Content is required
 * @returns {Object} 502 - Claude API error
 * @returns {Object} 503 - AI service not configured
 *
 * @example
 * // Request
 * POST /api/ai/suggest-title
 * { "content": "<p>Meeting notes from the Q4 planning session...</p>" }
 *
 * // Response
 * { "title": "Q4 Planning Meeting Notes" }
 */
const suggestTitle = async (req, res, next) => {
  try {
    const { content } = req.body;

    // ── Input Validation ───────────────────────────────────────────────────
    if (!content || !content.trim()) {
      return res.status(400).json({
        error: {
          message: 'Content is required to generate a title',
          code: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }

    // ── Check API Configuration ────────────────────────────────────────────
    const apiKey = process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: {
          message: 'AI service is not configured',
          code: 'SERVICE_UNAVAILABLE',
          status: 503
        }
      });
    }

    // ── Prepare Content ────────────────────────────────────────────────────
    // Strip HTML tags for cleaner content analysis
    // "<p>Hello <strong>world</strong></p>" → "Hello world"
    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Limit content length for API efficiency and cost
    const truncatedContent = plainText.substring(0, 2000);

    // ── Call Claude API ────────────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',  // Fast, cost-effective model
        max_tokens: 50,                      // Titles are short
        messages: [
          {
            role: 'user',
            content: `Generate a short, concise title (max 8 words) for this note. Only respond with the title, nothing else:\n\n${truncatedContent}`
          }
        ]
      })
    });

    // ── Handle API Errors ──────────────────────────────────────────────────
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Claude API error:', response.status, errorData);
      return res.status(502).json({
        error: {
          message: errorData.error?.message || 'Failed to generate title',
          code: 'AI_ERROR',
          status: 502,
          details: errorData.error?.type || 'Unknown error'
        }
      });
    }

    // ── Parse Response ─────────────────────────────────────────────────────
    const data = await response.json();
    const suggestedTitle = data.content[0]?.text?.trim() || 'Untitled';

    res.json({ title: suggestedTitle });
  } catch (error) {
    console.error('AI title suggestion error:', error);
    next(error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  suggestTitle
};

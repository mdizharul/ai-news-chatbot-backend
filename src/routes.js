import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  generateAnswer,
  getChatHistory,
  clearSession,
  getArticles,
  getEmbeddingsCount,
} from "./services.js";

const router = express.Router();

// ============ SESSION ROUTES ============

/**
 * POST /api/sessions
 * Create a new chat session
 */
router.post("/sessions", (req, res) => {
  try {
    const sessionId = uuidv4();
    console.log(`📝 Created new session: ${sessionId}`);

    res.status(201).json({
      success: true,
      sessionId,
      message: "Session created successfully",
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create session",
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Clear/delete a session
 */
router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    const deleted = await clearSession(sessionId);
    console.log(`🗑️  Session ${sessionId} cleared: ${deleted}`);

    res.json({
      success: true,
      deleted,
      message: deleted ? "Session cleared successfully" : "Session not found",
    });
  } catch (error) {
    console.error("Error clearing session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear session",
    });
  }
});

// ============ CHAT ROUTES ============

/**
 * POST /api/chat
 * Send a message and get AI response
 */
router.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Validation
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "Message is required and must be a string",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message cannot be empty",
      });
    }

    console.log(
      `💬 [${sessionId.slice(0, 8)}] User: ${message.slice(0, 50)}...`
    );

    // Generate answer
    const { answer, sources } = await generateAnswer(message, sessionId);

    res.json({
      success: true,
      response: answer,
      sources,
      timestamp: Date.now(),
      sessionId,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate response",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/history/:sessionId
 * Get chat history for a session
 */
router.get("/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    const history = await getChatHistory(sessionId);
    console.log(
      `📜 Retrieved history for ${sessionId.slice(0, 8)}: ${
        history.length
      } messages`
    );

    res.json({
      success: true,
      history,
      count: history.length,
      sessionId,
    });
  } catch (error) {
    console.error("Error getting history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve history",
    });
  }
});

// ============ UTILITY ROUTES ============

/**
 * GET /api/health
 * Health check endpoint
 */
// NEW
router.get("/health", async (req, res) => {
  // ✅ Added async
  const articles = getArticles();
  const embeddingsCount = await getEmbeddingsCount(); // ✅ Await the async function

  res.json({
    success: true,
    status: "healthy",
    timestamp: Date.now(),
    data: {
      articlesLoaded: articles.length,
      embeddingsCreated: embeddingsCount, // ✅ Use the count from Qdrant
      vectorDB: "Qdrant Cloud", // ✅ Added this info
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node: process.version,
    },
  });
});

/**
 * GET /api/articles
 * Get list of all loaded articles
 */
router.get("/articles", (req, res) => {
  try {
    const articles = getArticles();
    const limit = parseInt(req.query.limit) || articles.length;

    res.json({
      success: true,
      articles: articles.slice(0, limit).map((a) => ({
        title: a.title,
        link: a.link,
        pubDate: a.pubDate,
        preview: a.description.slice(0, 150) + "...",
      })),
      total: articles.length,
      showing: Math.min(limit, articles.length),
    });
  } catch (error) {
    console.error("Error getting articles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve articles",
    });
  }
});

/**
 * GET /api/stats
 * Get system statistics
 */
// NEW
router.get("/stats", async (req, res) => {
  // ✅ Added async

  const articles = getArticles();
  const embeddingsCount = await getEmbeddingsCount(); // ✅ Await

  res.json({
    success: true,
    stats: {
      totalArticles: articles.length,
      totalEmbeddings: embeddingsCount, // ✅ Use count from Qdrant
      vectorDB: "Qdrant Cloud",
      sources: articles.reduce((acc, article) => {
        const domain = new URL(article.link).hostname;
        acc[domain] = (acc[domain] || 0) + 1;
        return acc;
      }, {}),
      oldestArticle: articles[articles.length - 1]?.pubDate,
      newestArticle: articles[0]?.pubDate,
    },
  });
});

/**
 * 404 handler
 */
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
  });
});

export default router;

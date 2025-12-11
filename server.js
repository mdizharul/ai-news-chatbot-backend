import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectRedis, CONFIG } from "./src/config.js";
import { initializeServices } from "./src/services.js";
import router from "./src/routes.js";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["GEMINI_API_KEY"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  console.error("Please create a .env file with the required variables");
  process.exit(1);
}

// Create Express app
const app = express();

// ============ MIDDLEWARE ============

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ============ ROUTES ============

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "News Chatbot API",
    version: "1.0.0",
    endpoints: {
      health: "GET /api/health",
      createSession: "POST /api/sessions",
      chat: "POST /api/chat",
      history: "GET /api/history/:sessionId",
      clearSession: "DELETE /api/sessions/:sessionId",
      articles: "GET /api/articles",
      stats: "GET /api/stats",
    },
    documentation: "See README.md for full API documentation",
  });
});

// API routes
app.use("/api", router);

// ============ ERROR HANDLING ============

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
  });
});

// ============ SERVER STARTUP ============

async function startServer() {
  try {
    console.log("🚀 Starting News Chatbot Backend...\n");

    // Step 1: Connect to Redis
    console.log("📡 Connecting to Redis...");
    await connectRedis();

    // Step 2: Initialize services (fetch news + create embeddings)
    console.log("\n📚 Initializing services...");
    await initializeServices();

    // Step 3: Start Express server
    console.log("\n🌐 Starting Express server...");
    app.listen(CONFIG.PORT, () => {
      console.log("\n" + "=".repeat(50));
      console.log("✅ SERVER READY");
      console.log("=".repeat(50));
      console.log(`🚀 Server running on port ${CONFIG.PORT}`);
      console.log(`🔗 Local: http://localhost:${CONFIG.PORT}`);
      console.log(`🔗 API Docs: http://localhost:${CONFIG.PORT}/api`);
      console.log(
        `📊 Health Check: http://localhost:${CONFIG.PORT}/api/health`
      );
      console.log("=".repeat(50) + "\n");
      console.log("💡 Ready to receive requests!\n");
    });
  } catch (error) {
    console.error("\n❌ Failed to start server:", error);
    console.error("\nTroubleshooting:");
    console.error("1. Check if Redis is running: redis-cli ping");
    console.error("2. Verify GEMINI_API_KEY in .env file");
    console.error("3. Check internet connection for news feeds");
    console.error("\nServer will exit now.\n");
    process.exit(1);
  }
}

// ============ GRACEFUL SHUTDOWN ============

process.on("SIGTERM", async () => {
  console.log("\n⚠️  SIGTERM received, shutting down gracefully...");
  try {
    await redisClient.quit();
    console.log("✅ Redis connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("\n⚠️  SIGINT received, shutting down gracefully...");
  try {
    await redisClient.quit();
    console.log("✅ Redis connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

// ============ START ============

startServer();

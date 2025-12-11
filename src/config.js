import { createClient } from "redis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

// ============ REDIS CONFIGURATION ============
console.log(
  "🔍 Redis URL from env:",
  process.env.REDIS_URL ? "Found" : "Not found"
);

export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Max reconnection attempts reached");
        return new Error("Redis connection failed");
      }
      console.log(`Reconnecting to Redis... attempt ${retries}`);
      return retries * 100;
    },
    connectTimeout: 10000,
  },
});

redisClient.on("error", (err) =>
  console.error("❌ Redis Client Error:", err.message)
);
redisClient.on("connect", () => console.log("✅ Redis connected"));
redisClient.on("ready", () => console.log("✅ Redis ready to use"));

export async function connectRedis() {
  try {
    console.log("Attempting to connect to Redis...");
    console.log(
      "Using URL:",
      process.env.REDIS_URL ? "Cloud Redis" : "localhost:6379"
    );
    await redisClient.connect();
    console.log("✅ Redis client ready");
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error.message);
    throw error;
  }
}

// ============ QDRANT CONFIGURATION ============
export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// ============ GEMINI AI CONFIGURATION ============
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  },
});

// ============ APP CONFIGURATION ============
export const CONFIG = {
  PORT: process.env.PORT || 5000,
  SESSION_TTL: 3600, // 1 hour
  TOP_K_RESULTS: 20,
  MAX_ARTICLES: 100,

  // RSS Feeds
  NEWS_FEEDS: [
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "http://feeds.bbci.co.uk/news/world/rss.xml",
    "http://feeds.bbci.co.uk/news/technology/rss.xml",
  ],

  // Web Scraping Sites
  SCRAPE_SITES: [
    {
      name: "The Guardian",
      url: "https://www.theguardian.com/international",
      selector: {
        article: "[data-component='Card']",
        title: "[data-link-name='article'] h3, [data-link-name='article'] span",
        description: "[data-link-name='article'] p",
        link: "[data-link-name='article']",
      },
    },
    {
      name: "TechCrunch",
      url: "https://techcrunch.com",
      selector: {
        article: "article.post-block",
        title: ".post-block__title",
        description: ".post-block__content",
        link: ".post-block__title__link",
      },
    },
    {
      name: "Reuters",
      url: "https://www.reuters.com/world/",
      selector: {
        article: "[data-testid='MediaStoryCard']",
        title: "h3",
        description: "p",
        link: "a",
      },
    },
  ],

  JINA_API_URL: "https://api.jina.ai/v1/embeddings",
  JINA_MODEL: "jina-embeddings-v2-base-en",
  BATCH_SIZE: 10,
  QDRANT_COLLECTION: process.env.QDRANT_COLLECTION || "news_articles",
  VECTOR_SIZE: 768,
};

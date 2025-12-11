import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { redisClient, geminiModel, qdrantClient, CONFIG } from "./config.js";

// ============ NEWS SERVICE ============
let newsArticles = [];

// ============ WEB SCRAPING FUNCTION ============
async function scrapeWebsite(siteConfig) {
  try {
    console.log(`  🌐 Scraping ${siteConfig.name}...`);

    const response = await fetch(siteConfig.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const articles = [];
    const articleElements = $(siteConfig.selector.article);

    articleElements.each((index, element) => {
      if (index >= 15) return; // Limit to 15 per site

      try {
        const $el = $(element);
        const title = $el.find(siteConfig.selector.title).first().text().trim();
        const description = $el
          .find(siteConfig.selector.description)
          .first()
          .text()
          .trim();
        let link = $el.find(siteConfig.selector.link).first().attr("href");

        // Handle relative URLs
        if (link && !link.startsWith("http")) {
          const baseUrl = new URL(siteConfig.url);
          link = `${baseUrl.origin}${link.startsWith("/") ? "" : "/"}${link}`;
        }

        if (title && link) {
          articles.push({
            id: `${siteConfig.name}-${index}`,
            title: title.substring(0, 200),
            description: description ? description.substring(0, 500) : title,
            link,
            pubDate: new Date().toISOString(),
            fullText: `${title} ${description || ""}`.substring(0, 2000),
            source: siteConfig.name,
          });
        }
      } catch (err) {
        // Skip problematic articles
      }
    });

    console.log(
      `    ✓ Scraped ${articles.length} articles from ${siteConfig.name}`
    );
    return articles;
  } catch (error) {
    console.error(`    ✗ Failed to scrape ${siteConfig.name}:`, error.message);
    return [];
  }
}

// ============ RSS PARSING FUNCTION ============
async function fetchRSSFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl, { timeout: 10000 });
    const xmlText = await response.text();
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];

    const articles = items.slice(0, 20).map((item, index) => {
      const title =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        item.match(/<title>(.*?)<\/title>/)?.[1] ||
        "";

      const description =
        item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
        item.match(/<description>(.*?)<\/description>/)?.[1] ||
        "";

      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

      return {
        id: `${feedUrl}-${index}`,
        title: title.replace(/<[^>]*>/g, ""),
        description: description.replace(/<[^>]*>/g, ""),
        link,
        pubDate,
        fullText: `${title} ${description}`.replace(/<[^>]*>/g, ""),
        source: "RSS Feed",
      };
    });

    console.log(
      `  ✓ Fetched ${articles.length} articles from ${feedUrl.split("/")[2]}`
    );
    return articles;
  } catch (err) {
    console.error(`  ✗ Failed to fetch ${feedUrl}:`, err.message);
    return [];
  }
}

// ============ COMBINED NEWS FETCHING ============
export async function fetchNewsArticles() {
  try {
    console.log("📰 Fetching news articles from multiple sources...\n");
    let allArticles = [];

    // 1. Fetch from RSS feeds
    console.log("📡 Fetching RSS feeds...");
    for (const feedUrl of CONFIG.NEWS_FEEDS) {
      const articles = await fetchRSSFeed(feedUrl);
      allArticles = allArticles.concat(articles);
    }

    // 2. Scrape from websites
    console.log("\n🕷️  Scraping websites...");
    for (const site of CONFIG.SCRAPE_SITES) {
      const scrapedArticles = await scrapeWebsite(site);
      allArticles = allArticles.concat(scrapedArticles);

      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    newsArticles = allArticles.slice(0, CONFIG.MAX_ARTICLES);
    console.log(
      `\n✅ Loaded ${newsArticles.length} total articles (RSS: ${CONFIG.NEWS_FEEDS.length} feeds, Scraped: ${CONFIG.SCRAPE_SITES.length} sites)`
    );
    return newsArticles;
  } catch (error) {
    console.error("❌ Error fetching articles:", error);
    throw error;
  }
}

// ============ QDRANT INITIALIZATION ============
export async function initializeQdrant() {
  try {
    console.log("🔄 Initializing Qdrant collection...");

    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      (c) => c.name === CONFIG.QDRANT_COLLECTION
    );

    if (!collectionExists) {
      console.log(`📦 Creating collection: ${CONFIG.QDRANT_COLLECTION}`);
      await qdrantClient.createCollection(CONFIG.QDRANT_COLLECTION, {
        vectors: {
          size: CONFIG.VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      console.log(
        `✅ Collection '${CONFIG.QDRANT_COLLECTION}' created successfully`
      );
    } else {
      console.log(`✅ Collection '${CONFIG.QDRANT_COLLECTION}' already exists`);
    }
  } catch (error) {
    console.error("❌ Failed to initialize Qdrant:", error.message);
    throw error;
  }
}

// ============ EMBEDDING SERVICE ============
async function getJinaBatchEmbeddings(texts) {
  try {
    if (!process.env.JINA_API_KEY) {
      throw new Error("No Jina API key");
    }

    const processedTexts = texts.map((text) => text.slice(0, 8000));
    console.log(`  📊 Calling Jina API for ${texts.length} texts...`);

    const response = await fetch(CONFIG.JINA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        input: processedTexts,
        model: CONFIG.JINA_MODEL,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jina API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`  ✅ Received ${data.data.length} embeddings from Jina`);
    return data.data.map((item) => item.embedding);
  } catch (error) {
    console.log(`  ⚠️ Jina API error: ${error.message}, using fallback`);
    return texts.map((text) => createSimpleEmbedding(text));
  }
}

async function getJinaEmbedding(text) {
  const embeddings = await getJinaBatchEmbeddings([text]);
  return embeddings[0];
}

function createSimpleEmbedding(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordFreq = {};
  words.forEach((word) => {
    if (word.length > 2) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);
  const vocab = topWords.map(([word]) => word);
  const embedding = vocab.map((word) => wordFreq[word] || 0);

  while (embedding.length < 768) {
    embedding.push(0);
  }

  return embedding.slice(0, 768);
}

// ============ STORE EMBEDDINGS IN QDRANT ============
export async function createArticleEmbeddings() {
  console.log("🔄 Creating embeddings with batching...");
  const batchSize = CONFIG.BATCH_SIZE;
  const totalBatches = Math.ceil(newsArticles.length / batchSize);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, newsArticles.length);
    const batch = newsArticles.slice(start, end);

    console.log(
      `\n📦 Processing batch ${i + 1}/${totalBatches} (${
        batch.length
      } articles)`
    );

    try {
      const texts = batch.map((article) => article.fullText);
      const embeddings = await getJinaBatchEmbeddings(texts);

      const points = batch.map((article, idx) => ({
        id: start + idx,
        vector: embeddings[idx],
        payload: {
          articleId: article.id,
          title: article.title,
          description: article.description,
          link: article.link,
          pubDate: article.pubDate,
          fullText: article.fullText,
          source: article.source,
        },
      }));

      await qdrantClient.upsert(CONFIG.QDRANT_COLLECTION, {
        wait: true,
        points: points,
      });

      console.log(`  ✅ Uploaded batch ${i + 1} to Qdrant`);

      if (i < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  ❌ Error processing batch ${i + 1}:`, error.message);
      throw error;
    }
  }

  console.log(
    `\n✅ Created and stored ${newsArticles.length} embeddings in Qdrant`
  );
  return newsArticles.length;
}

// ============ VECTOR SEARCH WITH QDRANT ============
export async function retrieveRelevantArticles(
  query,
  topK = CONFIG.TOP_K_RESULTS
) {
  try {
    console.log(`🔍 Searching for: "${query.slice(0, 50)}..."`);

    const queryEmbedding = await getJinaEmbedding(query);

    const searchResult = await qdrantClient.search(CONFIG.QDRANT_COLLECTION, {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true,
    });

    console.log(`  ✅ Found ${searchResult.length} relevant articles`);
    console.log(
      `  📊 Scores: ${searchResult.map((r) => r.score.toFixed(3)).join(", ")}`
    );

    const articles = searchResult.map((result) => ({
      id: result.payload.articleId,
      title: result.payload.title,
      description: result.payload.description,
      link: result.payload.link,
      pubDate: result.payload.pubDate,
      fullText: result.payload.fullText,
      source: result.payload.source,
      score: result.score,
    }));

    return articles;
  } catch (error) {
    console.error("❌ Error retrieving articles:", error);
    throw error;
  }
}

// ============ RAG SERVICE ============
export async function generateAnswer(query, sessionId) {
  try {
    const relevantArticles = await retrieveRelevantArticles(query);

    const context = relevantArticles
      .map(
        (article, i) =>
          `[Source ${i + 1}] (${article.source} - Relevance: ${(
            article.score * 100
          ).toFixed(1)}%)\n` +
          `Title: ${article.title}\n` +
          `Content: ${article.description}\n` +
          `URL: ${article.link}\n` +
          `Published: ${article.pubDate}`
      )
      .join("\n\n");

    const historyJson = await redisClient.get(`session:${sessionId}`);
    const history = historyJson ? JSON.parse(historyJson) : [];

    const conversationContext =
      history.length > 0
        ? "\n\nPrevious conversation:\n" +
          history
            .slice(-6)
            .map(
              (h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`
            )
            .join("\n")
        : "";

    const prompt = `You are a knowledgeable and helpful news assistant. Your task is to answer the user's question based on the provided news articles.

Guidelines:
- Provide accurate, well-informed answers based on the sources
- Use clear headings with ## for main topics  
- Use bullet points (-) for lists
- Write in a conversational, friendly tone
- Cite specific sources when referencing information (e.g., "According to Source 1...")
- Keep paragraphs short (2-3 sentences max)
- If the articles don't contain enough information, acknowledge this

News Sources (with relevance scores and sources):
${context}
${conversationContext}

User Question: ${query}

Please provide a clear, well-formatted answer using markdown:`;

    console.log("🤖 Generating response with Gemini...");
    const result = await geminiModel.generateContent(prompt);
    const answer = result.response.text();

    history.push({
      role: "user",
      content: query,
      timestamp: Date.now(),
    });

    history.push({
      role: "assistant",
      content: answer,
      timestamp: Date.now(),
      sources: relevantArticles.map((a) => ({
        title: a.title,
        link: a.link,
        source: a.source,
        score: a.score,
      })),
    });

    await redisClient.set(`session:${sessionId}`, JSON.stringify(history), {
      EX: CONFIG.SESSION_TTL,
    });

    console.log("✅ Response generated and cached");

    return {
      answer,
      sources: relevantArticles.map((a) => ({
        title: a.title,
        link: a.link,
        pubDate: a.pubDate,
        source: a.source,
        relevance: (a.score * 100).toFixed(1) + "%",
      })),
    };
  } catch (error) {
    console.error("❌ Error generating answer:", error);
    throw error;
  }
}

// ============ CHAT SERVICE ============
export async function getChatHistory(sessionId) {
  try {
    const historyJson = await redisClient.get(`session:${sessionId}`);
    const history = historyJson ? JSON.parse(historyJson) : [];
    return history;
  } catch (error) {
    console.error("❌ Error getting history:", error);
    return [];
  }
}

export async function clearSession(sessionId) {
  try {
    const deleted = await redisClient.del(`session:${sessionId}`);
    return deleted > 0;
  } catch (error) {
    console.error("❌ Error clearing session:", error);
    throw error;
  }
}

// ============ INITIALIZATION ============
export async function initializeServices() {
  try {
    await initializeQdrant();
    await fetchNewsArticles();
    await createArticleEmbeddings();
    console.log("✅ All services initialized with RSS + Web Scraping + Qdrant");
  } catch (error) {
    console.error("❌ Failed to initialize services:", error);
    throw error;
  }
}

// ============ GETTERS ============
export function getArticles() {
  return newsArticles;
}

export async function getEmbeddingsCount() {
  try {
    const info = await qdrantClient.getCollection(CONFIG.QDRANT_COLLECTION);
    return info.points_count || 0;
  } catch (error) {
    return 0;
  }
}

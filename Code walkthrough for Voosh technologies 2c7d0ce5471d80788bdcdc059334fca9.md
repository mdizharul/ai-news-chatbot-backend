# Code walkthrough for Voosh technologies

Created Date: December 12, 2025

# 🚀 **Overview**

This is an end-to-end **RAG-based News Chatbot** that retrieves the latest world news, embeds articles using **Jina embeddings**, stores vectors inside **Qdrant**, retrieves relevant content using semantic search, and generates summaries or answers using **Google Gemini**.

The app is full-stack:

- **Backend:** Node.js + Express
- **Frontend:** React + Vite
- **Vector DB:** Qdrant
- **Embeddings:** Jina
- **LLM:** Gemini
- **Cache / Sessions:** Redis Cloud

The system fetches news at startup, warms caches, precomputes embeddings, and serves intelligent, source-grounded responses to user queries.

This project is built for interview-ready demonstration: clean architecture, cache layers, batching, LLM prompt engineering, and RAG pipeline.

---

# 🌐 **Live Features**

### ✔️ Fetches 50+ real-time news articles

### ✔️ Batches embeddings using Jina

### ✔️ Stores & indexes embeddings in Qdrant

### ✔️ Performs ANN vector search for relevant articles

### ✔️ Uses Gemini to generate summarised answers

### ✔️ Maintains per-session conversation history via Redis

### ✔️ Auto TTL-based cleanup

### ✔️ Modern chat UI with source citations

### ✔️ Fully deployable on Render + Vercel

---

# 🏗️ **System Architecture**

Below is a high-level architecture diagram of the entire system:

```
                ┌─────────────────────────┐
                │        Frontend         │
                │   (React + Vite)        │
                └──────────┬──────────────┘
                           │  REST API Calls
                           ▼
                ┌─────────────────────────┐
                │       Backend API       │
                │    (Node.js + Express)  │
                └──────────┬──────────────┘
     Initialization         │ Chat Flow
     ┌──────────────────────┴───────────────────────────────┐
     │                                                      │
     ▼                                                      ▼
┌───────────────┐                                 ┌──────────────────┐
│  RSS Feeds     │                                 │ Redis (Sessions) │
│ Fetch Articles │                                 │ Chat history TTL │
└───────┬────────┘                                 └────────┬─────────┘
        │ 50 Articles Loaded                          TTL=3600 seconds
        ▼
┌───────────────────┐
│  Jina Embeddings   │
│ Batch = 10         │
└───────┬────────────┘
        │ Embeddings
        ▼
┌────────────────────────────────┐
│     Qdrant Vector Database     │
│  - Cosine similarity search    │
│  - Store vectors + metadata    │
└───────┬────────────────────────┘
        │ Query Embedding
        ▼
┌────────────────────────────────┐
│       RAG + Prompt Builder      │
│ Retrieve top-k relevant chunks  │
│ Build grounded LLM prompt       │
└───────┬────────────────────────┘
        │ Context + Query
        ▼
┌────────────────────────────────┐
│        Gemini LLM              │
│   Answer + Summaries + Sources │
└────────────────────────────────┘

```

---

# 🔍 **End-to-End Flow (Code Walkthrough)**

## **1. Startup: Cache Warming & Embedding Pipeline**

### 🔹 Step 1 — Fetch news articles

On server start, `initializeServices()` runs:

```jsx
newsArticles = await fetchNewsArticles();

```

It loads 50 articles from RSS feeds into memory.

---

### 🔹 Step 2 — Create batched embeddings using Jina

`createArticleEmbeddings()` embeds all articles in **batches of 10**:

```jsx
📦 Processing batch 1/5
📊 Calling Jina API...

```

If Jina fails, the code automatically falls back to local simple embeddings.

---

### 🔹 Step 3 — Store embeddings in Qdrant

For each article:

```jsx
{
  id: <articleId>,
  vector: <embedding>,
  payload: { title, link, excerpt }
}

```

Upserted into Qdrant for fast semantic search.

Your backend logs show:

```
Created and stored 50 embeddings in Qdrant

```

---

## **2. Query-Time Flow (When User Sends a Message)**

### 🔹 Step 1 — Frontend sends message

```jsx
POST /api/chat
{
  message: "...",
  sessionId: "..."
}

```

---

### 🔹 Step 2 — Embed user query

Backend calls Jina again for single text:

```
Calling Jina API for 1 text...

```

---

### 🔹 Step 3 — Vector search in Qdrant

Search top-k (20) similar news articles:

```jsx
Found 20 relevant articles
Scores: 0.78, 0.77, 0.75 ...

```

---

### 🔹 Step 4 — RAG Prompt Construction

Selected article snippets + metadata are added to Gemini prompt:

```
Sources:
1. Title...
2. Title...

```

---

### 🔹 Step 5 — Gemini LLM generates final summary

Backend sends final answer including citations:

```json
{
  "response": "...summary...",
  "sources": [...]
}

```

---

## **3. Redis Session Caching + TTL**

### ✔ Stores entire conversation history

Each message is appended to:

```
session:<sessionId>

```

### ✔ TTL = 3600 seconds

```jsx
await redisClient.expire(redisKey, CONFIG.SESSION_TTL);

```

TTL resets on every message → old sessions auto-clean.

This fulfills the assignment requirement for:

- State management
- Cleanup
- Caching layer

---

# 💻 **Frontend Code Flow**

Frontend is built with **React + Vite**.

### ✔ Creates a session once

On load:

```jsx
POST /api/sessions
```

### ✔ Sends messages to backend

On user submit:

```jsx
POST /api/chat
```

### ✔ Displays results

- Assistant message bubble
- Source citations
- Scroll management
- Loading indicator

Beautiful and professional UX.

---

# ⚙️ **Installation & Running Locally**

### **Backend**

```bash
cd backend
npm install
npm start
```

Environment variables required:

```
PORT=5000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash-latest
JINA_API_KEY=
REDIS_URL=
VECTOR_DB=qdrant
QDRANT_URL=
QDRANT_API_KEY=
VECTOR_DIM=1536
```

---

### **Frontend**

```bash
cd frontend
npm install
npm run dev
```

Set:

```
VITE_API_URL=http://localhost:5000/api
```

---

# 🚀 **Deployment Guide**

### **Backend → Render**

- Deploy GitHub repo
- Set Node version to 18
- Add all environment variables
- [Backend URL:](https://ai-news-chatbot-backend.onrender.com)
    
    ```
    https://ai-news-chatbot-backend.onrender.com
    ```
    

### **Frontend → Vercel**

- Import GitHub repo
- Build command: `npm run build`
- Output folder: `dist`
- **Frontend URL:**
    
    ```
    https://ai-news-chatbot-frontend-57mnd7b5c-mdizharuls-projects.vercel.app/api
    ```
    

---

# 💡 **Noteworthy Design Decisions**

### ✔ Batch embeddings (Jina)

Better performance than single embedding per article.

### ✔ Qdrant Vector DB

Persistent ANN search with metadata and high throughput.

### ✔ Redis TTL-based session storage

Efficient, scalable, self-cleaning.

### ✔ RAG architecture

Ensures factual, source-grounded answers.

### ✔ Clear modular backend

- `services.js` → business logic
- `routes.js` → routing
- `config.js` → environment
- `redis` + `qdrant` + `jina` integrations

---

# 📈 **Possible Improvements**

### 🔹 Article chunking for even better RAG

### 🔹 Background cron job to refresh news hourly

### 🔹 Add WebSocket streaming from Gemini

### 🔹 Hybrid search (BM25 + Vector)

### 🔹 Add authentication (JWT)

### 🔹 Add rate limiting
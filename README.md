# News Chatbot Backend - RAG Pipeline

A production-ready REST API backend for a RAG-powered news chatbot using Express, Redis, and Google Gemini AI.

## 🎯 Features

- ✅ **RAG Pipeline**: Retrieval-Augmented Generation with news articles
- ✅ **Session Management**: Isolated chat sessions with Redis caching
- ✅ **Smart Embeddings**: Jina AI embeddings with simple fallback
- ✅ **Vector Search**: Cosine similarity for relevant article retrieval
- ✅ **LLM Integration**: Google Gemini Pro for response generation
- ✅ **Source Citations**: Responses include article sources
- ✅ **TTL Caching**: 1-hour session expiration
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Health Checks**: Monitoring endpoints

## 📁 Project Structure

```
news-chatbot-backend/
├── src/
│   ├── config.js          # Redis, Gemini, and app configuration
│   ├── services.js        # Business logic (news, embeddings, RAG)
│   └── routes.js          # API endpoints and controllers
├── server.js              # Main entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (create this)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Redis** - [Installation Guide](https://redis.io/docs/getting-started/)
- **Gemini API Key** - [Get Free Key](https://aistudio.google.com/apikey)

### Installation

1. **Clone and install**

```bash
git clone <your-repo-url>
cd news-chatbot-backend
npm install
```

2. **Setup environment**

```bash
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
REDIS_URL=redis://localhost:6379
PORT=5000
JINA_API_KEY=optional_jina_key_for_better_embeddings
NODE_ENV=development
```

3. **Start Redis**

```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo service redis-server start

# Windows (WSL)
redis-server

# Or use Redis Cloud (free): https://redis.com/try-free/
```

4. **Run the server**

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:5000` 🎉

## 📚 API Documentation

### Base URL

```
http://localhost:5000/api
```

### Endpoints

#### 1. Create Session

Creates a new chat session and returns a session ID.

```bash
POST /api/sessions
```

**Response:**

```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Session created successfully"
}
```

#### 2. Send Chat Message

Send a message and receive AI-generated response with sources.

```bash
POST /api/chat
Content-Type: application/json

{
  "message": "What are the latest technology news?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "success": true,
  "response": "Based on recent technology news...",
  "sources": [
    {
      "title": "Article Title",
      "link": "https://example.com/article",
      "pubDate": "Mon, 10 Dec 2024 12:00:00 GMT"
    }
  ],
  "timestamp": 1702209600000,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 3. Get Chat History

Retrieve conversation history for a session.

```bash
GET /api/history/:sessionId
```

**Response:**

```json
{
  "success": true,
  "history": [
    {
      "role": "user",
      "content": "What's happening in tech?",
      "timestamp": 1702209500000
    },
    {
      "role": "assistant",
      "content": "Recent technology developments include...",
      "timestamp": 1702209600000,
      "sources": [...]
    }
  ],
  "count": 2,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 4. Clear Session

Delete a session and its history.

```bash
DELETE /api/sessions/:sessionId
```

**Response:**

```json
{
  "success": true,
  "deleted": true,
  "message": "Session cleared successfully"
}
```

#### 5. Health Check

Check server status and loaded data.

```bash
GET /api/health
```

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": 1702209600000,
  "data": {
    "articlesLoaded": 50,
    "embeddingsCreated": 50,
    "uptime": 1234.56,
    "memory": {...},
    "node": "v18.17.0"
  }
}
```

#### 6. Get Articles

List all loaded news articles.

```bash
GET /api/articles?limit=10
```

**Response:**

```json
{
  "success": true,
  "articles": [
    {
      "title": "Article Title",
      "link": "https://example.com/article",
      "pubDate": "Mon, 10 Dec 2024 12:00:00 GMT",
      "preview": "Article description preview..."
    }
  ],
  "total": 50,
  "showing": 10
}
```

#### 7. System Stats

Get system statistics and source breakdown.

```bash
GET /api/stats
```

## 🔧 How It Works

### RAG Pipeline Flow

```
1. News Ingestion
   ↓
2. Embedding Creation (Jina AI / Simple TF-IDF)
   ↓
3. User Query → Query Embedding
   ↓
4. Vector Similarity Search (Cosine)
   ↓
5. Top-K Article Retrieval
   ↓
6. Context Building + Chat History
   ↓
7. Gemini API Generation
   ↓
8. Response + Redis Cache (1hr TTL)
```

### Technical Details

**Embedding Strategy:**

- Primary: Jina AI embeddings (`jina-embeddings-v2-base-en`)
- Fallback: TF-IDF style embeddings
- Automatic fallback on API failure

**Vector Search:**

- Cosine similarity for relevance scoring
- Top-3 most relevant articles retrieved
- In-memory vector store (scalable to Qdrant/Pinecone)

**Caching:**

- Redis stores full conversation history
- TTL: 3600 seconds (1 hour)
- Key pattern: `session:{uuid}`
- Automatic expiration prevents memory bloat

**News Sources:**

- NYTimes World RSS
- NYTimes Technology RSS
- NYTimes Business RSS
- Fetches 50 most recent articles on startup

## 🧪 Testing

### Manual Testing

```bash
# 1. Health check
curl http://localhost:5000/api/health

# 2. Create session
SESSION_ID=$(curl -s -X POST http://localhost:5000/api/sessions | jq -r '.sessionId')
echo $SESSION_ID

# 3. Send message
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"What are the latest world news?\",\"sessionId\":\"$SESSION_ID\"}"

# 4. Get history
curl http://localhost:5000/api/history/$SESSION_ID

# 5. Clear session
curl -X DELETE http://localhost:5000/api/sessions/$SESSION_ID
```

### Testing with Postman

Import these endpoints:

- POST `http://localhost:5000/api/sessions`
- POST `http://localhost:5000/api/chat`
- GET `http://localhost:5000/api/history/:sessionId`
- DELETE `http://localhost:5000/api/sessions/:sessionId`

## 📊 Performance & Caching

### Redis Configuration

```javascript
TTL: 3600 seconds (1 hour)
Key Pattern: session:{uuid}
Storage: JSON serialized conversation history
```

### Cache Warming

- Articles fetched on server startup
- Embeddings pre-computed
- No cold start for queries
- ~30-60 seconds initialization time

### Optimization Strategies

1. **In-memory vector store** - Zero network latency
2. **Batch embedding creation** - Parallel processing
3. **Redis pipelining** - Faster cache operations
4. **Top-K limiting** - Only retrieve 3 most relevant articles
5. **Session TTL** - Automatic cleanup prevents memory leaks

## 🚀 Deployment

### Option 1: Render.com (Recommended)

1. Push code to GitHub
2. Go to [Render](https://render.com/)
3. Create new **Web Service**
4. Connect your repository
5. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add environment variables:
   - `GEMINI_API_KEY`
   - `REDIS_URL` (use Render's Redis add-on)
7. Deploy!

### Option 2: Railway.app

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option 3: Heroku

```bash
# Create app
heroku create your-app-name

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set GEMINI_API_KEY=your_key_here

# Deploy
git push heroku main
```

### Free Redis Hosting

**Option A: Redis Cloud**

- https://redis.com/try-free/
- 30MB free tier
- Copy connection string to `REDIS_URL`

**Option B: Upstash**

- https://upstash.com/
- Serverless Redis
- Generous free tier

## 🐛 Troubleshooting

### Redis Connection Error

```bash
# Check if Redis is running
redis-cli ping
# Expected: PONG

# Check Redis connection
redis-cli
127.0.0.1:6379> ping
PONG
127.0.0.1:6379> exit
```

### Gemini API Error

- Verify API key at https://aistudio.google.com/apikey
- Check rate limits (60 requests/minute free tier)
- Ensure API is enabled for your project

### No Articles Loaded

- Check internet connection
- Verify RSS feeds are accessible
- Try alternative news sources
- Check firewall settings

### Port Already in Use

```bash
# Change port in .env
PORT=5001

# Or kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Out of Memory (Embeddings)

- Reduce `MAX_ARTICLES` in `config.js`
- Use simple embeddings instead of Jina
- Increase Node.js memory: `node --max-old-space-size=4096 server.js`

## 🔒 Environment Variables

| Variable         | Required    | Default                  | Description                |
| ---------------- | ----------- | ------------------------ | -------------------------- |
| `GEMINI_API_KEY` | ✅ Yes      | -                        | Google Gemini API key      |
| `REDIS_URL`      | ⚠️ Optional | `redis://localhost:6379` | Redis connection URL       |
| `PORT`           | ⚠️ Optional | `5000`                   | Server port                |
| `JINA_API_KEY`   | ❌ No       | -                        | Jina embeddings (optional) |
| `NODE_ENV`       | ❌ No       | `development`            | Environment mode           |
| `FRONTEND_URL`   | ❌ No       | `*`                      | CORS allowed origin        |

## 📈 Potential Improvements

- [ ] WebSocket support for streaming responses
- [ ] PostgreSQL for persistent conversation storage
- [ ] Rate limiting per IP/session
- [ ] Comprehensive test suite (Jest)
- [ ] Prometheus metrics
- [ ] Docker containerization
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Qdrant/Pinecone vector database
- [ ] Multi-language support
- [ ] Scheduled article refresh (cron)
- [ ] Admin dashboard
- [ ] API authentication (JWT)

## 📄 License

MIT

## 👨‍💻 Author

Md Izharul Ansari

---

**Questions?** Check the troubleshooting section or create an issue!

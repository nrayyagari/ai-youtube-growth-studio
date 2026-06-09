# AI YouTube Growth Studio

A planning tool for faceless YouTube channels. Generates complete video packages (idea, script, scenes, visuals, music, titles, thumbnails, SEO, QA) using free-tier LLM APIs. Runs fully locally — no cloud dependencies, no auth required.

## Features

- **7-Agent Pipeline**: Idea → Script → Visuals → Music → Titles → Thumbnails → QA
- **AI Provider Router**: Multi-provider (Gemini, Groq, Cerebras) with rate-limit cycling and fallback
- **Quality Gate**: Auto-approval threshold with scores across 8 dimensions
- **YouTube Analytics**: OAuth 2.0 integration for real channel stats (optional)
- **Content Repurposing**: Long-form → Shorts extraction
- **A/B Testing**: Title/thumbnail variant generation and scoring
- **Series Planning**: Multi-episode series with episode arcs
- **Content Calendar**: Schedule generation with publishing slots
- **Reference Intelligence**: Analyze competitor videos for patterns
- **TTS Narration**: Voiceover generation via edge_tts
- **Whisper Transcription**: Audio/video transcription (local or OpenAI)
- **Thumbnail Generation**: Gemini Imagen image generation

## Tech Stack

- **Backend**: FastAPI (Python) + SQLite (WAL mode)
- **Frontend**: React 19 + TypeScript + Vite
- **AI**: Gemini 2.0 Flash, Groq (Llama 3.3 70B), Cerebras (Llama 3.3 70B)

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Free API keys (at least one):
  - [Gemini](https://aistudio.google.com/apikey) (free tier)
  - [Groq](https://console.groq.com) (free tier)
  - [Cerebras](https://cloud.cerebras.ai) (free tier)

### Setup

```bash
# Clone and enter
cd ai-youtube-growth-studio

# Configure environment
cp .env.example .env
# Edit .env — add at least one API key

# Backend
cd backend
pip install -r requirements.txt

# Optional extras (TTS, Whisper, YouTube download)
pip install edge-tts openai-whisper yt-dlp

# Frontend
cd ../frontend
npm install
```

### Run (Development)

```bash
# Terminal 1 — Backend
cd backend && uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:5173

### Run (Production/Single Process)

```bash
cd frontend && npm run build
cd ../backend && uvicorn main:app
```

Open http://localhost:8000

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | At least one | Gemini 2.0 Flash API key |
| `GROK_API_KEY` | At least one | Groq API key (Llama 3.3 70B) |
| `CEREBRAS_API_KEY` | At least one | Cerebras API key (Llama 3.3 70B) |
| `DATABASE_URL` | No | Default: `sqlite:///./data/growth_studio.db` |
| `FRONTEND_ORIGIN` | No | Default: `http://localhost:5173` |
| `YOUTUBE_CLIENT_ID` | No | For YouTube Analytics integration |
| `YOUTUBE_CLIENT_SECRET` | No | For YouTube Analytics integration |
| `YOUTUBE_REDIRECT_URI` | No | Default: `http://localhost:8000/api/youtube/oauth/callback` |

## Architecture

```
backend/
  main.py              FastAPI app, routes, seed data
  core/
    config.py           Pydantic settings from .env
    database.py         SQLite init (17 tables)
    router.py           AI provider routing + rate limiting
    pipeline.py         7-agent sequential execution
    youtube_analytics.py OAuth 2.0 + YouTube API v3
  agents/
    base.py             ABC with JSON error recovery
    idea_agent.py       Video idea generation + scoring
    script_agent.py     Narration script writing
    visual_agent.py     Scene planning
    music_agent.py      Royalty-free music selection
    title_agent.py      Title + SEO generation
    thumbnail_agent.py  Thumbnail concept creation
    qa_agent.py         Copyright/monetization/quality audit
    master_router_agent.py      Style profile extraction
    reference_intelligence_agent.py  Trend + pattern detection
    ab_test_agent.py             Title/thumbnail A/B testing
    tts_agent.py                 Voiceover generation
    whisper_agent.py             Audio transcription
    thumbnail_generator.py       Image generation
    repurpose_agent.py           Long to Short extraction
  tests/                Unit tests
frontend/
  src/
    pages/              21 pages (Dashboard, Generator, Analytics, etc.)
    components/          Layout, Sidebar, ErrorBoundary, forms
    hooks/              useApi hook
    lib/                API client, TypeScript types
```

## License

MIT

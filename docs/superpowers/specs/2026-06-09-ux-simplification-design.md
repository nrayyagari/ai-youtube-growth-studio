# UX Simplification — Design Spec

**Date:** 2026-06-09
**Status:** Approved
**Scope:** Hide internals, progressive onboarding, simplified sidebar, 5 AI providers

---

## Summary

Redesign the user-facing UI so the app presents as a polished SaaS product, not a dev tool. Internal concepts (workflows, skills, agents, pipeline) are hidden. Users see only what they need: generate scripts, view results, manage settings. The sidebar shrinks from 17 links to 3.

---

## Constraints

- Backend routes, agents, and database tables remain unchanged — only UI changes
- Existing 7-agent pipeline continues to work behind the scenes
- Master Router Agent auto-selects workflow from topic — no user-facing workflow picker
- YouTube OAuth is kept for reading analytics data (improves script quality via analytical agents)
- No video/image/voice/music generation or assembly exposed to users

---

## Sidebar: Before vs After

**Before (17 links):**
Dashboard, Channels, Workflows, Skills, Generator, Calendar, Analytics, Competitors, Patterns, A/B Test, Upload, Compare, TTS, Whisper, Ch. Stats, Thumbnails, Settings

**After (3 links):**

| Link | What it does | Visibility |
|------|-------------|-----------|
| **Generate** | Create a video package — channel dropdown + topic input + one button | Always |
| **My Videos** | All generated packages. Search, filter, approve, regenerate. | Always |
| **Settings** | API keys, channel config, account, billing | Always |

No progressive unlocks needed — 3 links is already minimal.

---

## What Gets Removed from UI

| Page/Route | Disposition |
|-----------|------------|
| Dashboard (old) | Replaced by My Videos (`/my-videos`) |
| Channels (separate page) | Merged into Settings (channel is config, not content) |
| Workflows | Gone — Master Router auto-selects behind the scenes |
| Skills | Gone — internal only |
| TTS (separate page) | Gone from sidebar, backend agent stays |
| Whisper (separate page) | Gone from sidebar, backend agent stays |
| Thumbnails (separate page) | Gone from sidebar, backend agent stays |
| Upload (separate page) | Gone (no video to upload) |
| Compare | Gone (compare is a My Videos feature inline) |
| Competitors | Gone for now (future tier-unlock) |
| Patterns | Gone for now (future tier-unlock) |
| A/B Test | Gone for now (future tier-unlock) |
| Calendar | Gone for now (no videos to schedule) |

Backend routes, agents, database tables stay intact. Only frontend navigation and pages are removed/hidden.

---

## Auth & Onboarding Flow

### Sign Up
1. Landing page → "Start free" → Clerk modal (email, Google, GitHub)
2. After Clerk signup → webhook creates user in backend → redirect to `/generate`
3. Generator shows inline channel creation + topic input

### Login (returning user)
1. Landing page → "Log in" → Clerk modal
2. After login: Has packages? → `/my-videos`. No packages? → `/generate`.

### Landing Page
- Single CTA: "Start free — no credit card"
- Secondary: "Log in" for returning users
- Remove "Try local demo" button (confusing for SaaS)
- Remove pipeline visualization panel (exposes internals)

---

## Generator Page (`/generate`)

The only action a new user needs. Two inputs, one button.

```
Channel: [dropdown with existing channels] [New]
Topic:   [What's your video about? (optional)]
         [Generate Video →]

Free tier: 2 packages remaining this month
```

### Behavior
- Channel dropdown shows user's channels. "New" opens inline form (name + niche).
- Topic is optional — blank triggers Idea Agent to generate one.
- Master Router Agent analyzes topic and selects best workflow behind the scenes.
- During generation: animated progress ("Writing script... → Planning scenes... → Generating titles... → Running quality checks...")
- On completion: redirect to PackageDetail.

### What's Hidden
- No workflow/style picker (auto-selected)
- No agent names visible
- No "pipeline" terminology
- No scoring rules or QA checklist references

---

## My Videos Page (`/my-videos`)

Replaces the old Dashboard. Shows only the user's content.

- Table: ID, Topic/Title, Status (Approved/Needs Work), Date, Scores
- Search bar, status filter dropdown
- "Generate New" button top-right
- Click row → PackageDetail
- Empty state: "No videos yet. Generate your first one →" with button

---

## PackageDetail Page

Shows generation results with consumer-friendly naming.

| Internal Name | User-Facing Name |
|--------------|-----------------|
| Idea Agent score | Topic Strength |
| Script | Narration Script |
| Visual plan | Scene Plan |
| Music suggestions | Background Music |
| Titles + SEO | Titles & Tags |
| Thumbnail concept | Thumbnail Design |
| QA report | Content Review |
| Growth scores | Performance Prediction |

### Actions
- Approve — mark package as ready
- Regenerate — re-run pipeline with corrections

---

## Settings Page

Single settings page with tabs.

### Tabs
1. **API Keys** — 5 AI text providers + YouTube OAuth
2. **Channel** — name, niche, audience, language, upload frequency
3. **Account** — email, tier, upgrade button
4. **Billing** — payment method, invoice history (when Stripe/Razorpay configured)

### API Keys Tab

```
🧠 AI Text (at least one required)
├── Gemini API Key    — Gemini 2.0 Flash, 15 RPM free
├── Groq API Key      — Llama 3.3 70B, 30 RPM free
├── Cerebras API Key  — Llama 3.3 70B, 30 RPM free
├── DeepSeek API Key  — DeepSeek V3, ~$0.27/M tokens
└── OpenAI API Key    — GPT-4o-mini, small free credits

📊 YouTube (optional — improves script quality)
└── Connect Channel   — pulls views, CTR, retention, demographics
    → analytical agents use real data for better scripts
```

Each key input shows `•••• configured` when filled, `Enter key` placeholder when empty.

---

## Backend Changes

### New Provider: DeepSeek
Add to `core/router.py` `PROVIDERS` dict:
```python
"deepseek": {
    "model": "deepseek-chat",
    "rpm": 60,
    "endpoint": "https://api.deepseek.com/v1/chat/completions",
    "db_key": "deepseek_api_key",
}
```
Uses existing `_call_openai_compatible` method.

### New Provider: OpenAI
Add to `core/router.py` `PROVIDERS` dict:
```python
"openai": {
    "model": "gpt-4o-mini",
    "rpm": 100,
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "db_key": "openai_api_key",
}
```

### Config
Add to `core/config.py`:
```python
deepseek_api_key: str = ""
openai_api_key: str = ""
```

### API Keys Settings Route
Update `routes/settings.py` to return all 5 providers in the API keys endpoint.

---

## Frontend Route Changes

```tsx
// Remove routes:
// /dashboard, /channels, /workflows, /skills, /calendar,
// /competitors, /patterns, /ab-test, /upload, /compare,
// /tts, /whisper, /channel-analytics, /thumbnails
// /channels/:id/reference-videos, /channels/:id/style-profiles,
// /channels/:id/series

// Keep routes:
// /generate, /my-videos, /packages/:id, /settings, /, /pricing, /login, /signup
```

---

## Frontend Files

### Pages to Create/Modify
| Page | Action |
|------|--------|
| `pages/MyVideos.tsx` | **New** — replaces Dashboard |
| `pages/Generator.tsx` | **Rewrite** — simplified UI, inline channel creation, auto-workflow |
| `pages/Settings.tsx` | **Rewrite** — tabs for API keys, channel, account, billing |
| `pages/PackageDetail.tsx` | **Rename sections** — consumer-friendly labels |
| `pages/Landing.tsx` | **Simplify** — single CTA, remove pipeline panel |
| `pages/AuthRedirect.tsx` | **Update redirect** — goes to `/generate` not `/dashboard` |
| `components/layout/Sidebar.tsx` | **Reduce** — 3 links only |
| `App.tsx` | **Reduce routes** — remove 14 routes |

### Pages to Delete
| Page | Reason |
|------|--------|
| `pages/Dashboard.tsx` | Replaced by MyVideos |
| `pages/Channels.tsx` | Merged into Settings |
| `pages/Workflows.tsx` | Hidden from users |
| `pages/Skills.tsx` | Hidden from users |
| `pages/ReferenceVideos.tsx` | Hidden from users |
| `pages/StyleProfiles.tsx` | Hidden from users |
| `pages/SeriesPlanner.tsx` | Hidden from users |
| `pages/Analytics.tsx` | Hidden |
| `pages/ContentCalendar.tsx` | Hidden |
| `pages/CompetitorAnalysis.tsx` | Hidden |
| `pages/PatternLibrary.tsx` | Hidden |
| `pages/ABTestPage.tsx` | Hidden |
| `pages/YouTubeUpload.tsx` | Hidden |
| `pages/PackageCompare.tsx` | Hidden |
| `pages/TTSPage.tsx` | Hidden from sidebar |
| `pages/WhisperPage.tsx` | Hidden from sidebar |
| `pages/ChannelAnalytics.tsx` | Hidden from sidebar |
| `pages/ThumbnailGenerator.tsx` | Hidden from sidebar |

---

## Testing

- **Backend:** Add DeepSeek and OpenAI to router tests. All existing 109 tests must still pass.
- **Frontend:** Remove test cases for deleted pages. Update tests for modified pages. Add tests for new MyVideos page.

---

## Self-Review

- No placeholders or TBDs
- Architecture matches feature descriptions
- Scope is focused — only UI simplification, no new features beyond 2 AI providers
- No ambiguity — every removed page has a reason, every kept page has a purpose

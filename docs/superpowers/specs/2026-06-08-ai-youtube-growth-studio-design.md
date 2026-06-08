# AI YouTube Growth Studio — Design Spec

**Date:** 2026-06-08
**Status:** Approved
**Scope:** Phase 1

## Summary

A planning-only, single-user local web app for faceless YouTube channel growth. It generates complete video packages (idea, script, scenes, visuals, music, titles, thumbnails, SEO, QA) using free-tier LLM APIs. No video stitching, no subtitles, no rendering, no editing.

## Constraints

- Single-user, local-only. No auth, no multi-tenancy.
- React/Vite frontend (`localhost:5173`), FastAPI backend (`localhost:8000`), SQLite database.
- Only free-tier AI APIs (Gemini, Grok, Cerebras, etc.) with provider fallback.
- Must avoid YouTube copyright strikes and Content ID claims. Must support monetization.
- All scores threshold at 90/100 (9.0/10) for final approval.

## Architecture

```
Browser (localhost:5173) — React/Vite SPA
        │ REST JSON
FastAPI (localhost:8000)
        ├── API Routes (/api/channels, /api/workflows, /api/generate, ...)
        ├── Pipeline Runner (loads workflow → chains agents → returns result)
        ├── Agents (Idea, Script, Visual, Music, Title, Thumbnail, QA)
        ├── AI Provider Router (rate-limit-aware, cheapest-first, fallback on 429)
        └── Approval Gate (reads all scores, returns APPROVED/NEEDS_IMPROVEMENT)
                │
            SQLite (./data/growth_studio.db)
```

All pipeline execution is synchronous in Phase 1. Long generations show a loading spinner. No job queue.

## Database Schema

```sql
channels:
  id, name, niche, audience, target_country, language,
  content_mode (single_video|episode_series|mixed),
  monetization_goal, upload_frequency,
  banned_topics (JSON), created_at

workflows:
  id, name, description, script_format, scene_format,
  visual_style, music_style, qa_checklist (JSON),
  scoring_rules (JSON)

skills:
  id, name, category (research|script|visual|music|growth|qa),
  description, prompt_template

workflow_skills:
  workflow_id, skill_id, execution_order

agents:
  id, name, purpose, provider_preference, default_model

video_packages:
  id, channel_id, workflow_id,
  status (DRAFT|APPROVED|NEEDS_IMPROVEMENT|REJECTED|FAILED),
  created_at

package_sections:
  id, package_id, section_type (idea|script|scene_plan|visual_direction|
  image_prompts|motion_prompts|music|titles|thumbnail|description|
  tags|hashtags|pinned_comment|upload_checklist|qa_report|next_suggestion),
  content (JSON), score (0-100)

growth_scores:
  id, package_id, category (topic_demand|pain_point|ctr|retention|
  monetization|competition|series_potential|channel_fit),
  score, explanation

qa_reports:
  id, package_id, check_type (copyright|monetization|factual|
  script_quality|visual_consistency),
  score, status (PASS|WARN|FAIL), details

settings:
  key (api_key name), value (encrypted/masked), updated_at
```

Workflows and skills are data, not code. Adding a workflow or skill = insert a row.

## Agent Pipeline

Every agent implements:

```python
class BaseAgent:
    def process(self, channel: dict, inputs: dict, router: AIPRoviderRouter) -> dict:
        # returns {"output": {...}, "metadata": {...}}
```

Agents do not know about each other. The pipeline owns ordering.

Phase 1 agents (7 total):
1. **Idea Agent** — generates ideas + scores them
2. **Script Agent** — writes narration scripts + scores quality
3. **Visual Agent** — scene-by-scene plan + image/motion prompts
4. **Music Agent** — background music suggestion (royalty-free only)
5. **Title Agent** — title options + CTR potential scoring
6. **Thumbnail Agent** — thumbnail concepts
7. **QA Agent** — copyright safety, monetization safety, factual accuracy, script quality, visual consistency checks

Pipeline flow: Idea → Script → Visual → Music → Title → Thumbnail → QA → Approval Gate → Store Package.

Each creative agent self-scores its own output. QA handles compliance/policy only. Approval Gate consumes all scores for the final decision.

## AI Provider Router

```python
class AIPRoviderRouter:
    providers = {
        "gemini":   {"rpm": 15,  "tpm": 1_000_000},
        "grok":     {"rpm": 60,  "tpm": None},
        "cerebras": {"rpm": 30,  "tpm": None},
    }
    # tries highest-free-tier first (most generous rate limit),
    # falls back on RateLimitError, raises AllProvidersExhausted when all are spent
```

API keys stored in SQLite `settings` table, masked in API responses (`sk-...xyz`). Configured via Settings/API Keys page.

## Growth Scoring

Each creative agent injects a scoring rubric into its LLM prompt. Weights:

| Category | Weight |
|---|---|
| Topic Demand | 20% |
| Audience Pain Point | 15% |
| CTR Potential | 15% |
| Retention Potential | 15% |
| Monetization Potential | 15% |
| Competition Opportunity | 10% |
| Series Potential | 5% |
| Channel Fit | 5% |

Scores 0-100, stored per section, aggregated into package-level growth score.

## Approval Gate

All thresholds at 90/100:

```
growth_score       >= 90
script_score       >= 90
title_score        >= 90
thumbnail_score    >= 90
copyright_safety   >= 90
factual_accuracy   >= 90
retention          >= 90
monetization       >= 90
```

Result: `APPROVED` if all pass, `NEEDS_IMPROVEMENT` otherwise. Failing sections get a `correction_prompt` for the regenerate flow (`/api/packages/{id}/regenerate` regenerates only sections below threshold).

## Copyright & Monetization Safety

QA Agent checks:
- **Copyright safety**: no copied scripts, titles, thumbnails, or visual sequences. Pattern-level borrowing (hook structures, pacing rhythms) is allowed; topical/textual overlap is blocked. Similarity flag triggers manual review.
- **Monetization safety**: original content, no restricted topics per channel's `banned_topics`, advertiser-friendly language.
- **Music**: all suggestions from royalty-free sources only.
- **Reference videos**: YouTube URL analysis studies public metadata and transcript for pattern learning only. Never copies content.

## API Routes

```
POST   /api/channels                  Create channel
GET    /api/channels                  List channels
GET    /api/channels/{id}             Get channel with packages
PUT    /api/channels/{id}             Update channel
DELETE /api/channels/{id}             Delete channel

GET    /api/workflows                 List workflows with skills
GET    /api/skills                    List skills by category

POST   /api/generate                  Run pipeline → video package
GET    /api/packages                  List packages (filter by channel, status)
GET    /api/packages/{id}             Full package with all sections
DELETE /api/packages/{id}             Delete package
POST   /api/packages/{id}/approve     Run approval gate on existing package
POST   /api/packages/{id}/regenerate  Re-run pipeline for NEEDS_IMPROVEMENT

PUT    /api/settings/apikeys          Save/update API keys
GET    /api/settings/apikeys          Check which keys are configured
```

## Frontend Pages (Phase 1)

```
src/
  pages/          Dashboard, Channels, Workflows, Skills, Generator, PackageDetail, QAGrowthReport, Settings
  components/
    forms/        Channel form, workflow selection, API key form
    reports/      QA report, growth score breakdown, package display
    layout/       Nav, sidebar, page shell
  hooks/          useApi, useChannels, useWorkflows, usePackages
  lib/            api client, types
```

Pages: Dashboard, Channels, Workflows, Skills, Generator, Package Detail, QA/Growth Report, Settings/API Keys.

No state management library. React hooks + fetch. Loading/error states only.

Deferred to later phases: Analytics Dashboard, Next Video Recommendations, Episode Flow Planner, Reference Video Upload.

## Final Video Package Output

Each approved package includes:
1. Topic idea
2. Growth score report (weighted breakdown)
3. Full narration script
4. Scene-by-scene plan
5. On-screen text
6. Visual style instructions
7. Image prompts (for AI image generators)
8. Motion graphic prompts
9. Background music suggestion (royalty-free)
10. Title options
11. Thumbnail concepts
12. YouTube description
13. Tags
14. Hashtags
15. Pinned comment
16. Upload checklist
17. QA report
18. Next video suggestion

## Error Handling

- API route errors → `{"error": "...", "detail": "..."}` with appropriate HTTP status
- Pipeline agent failure → package status "FAILED" with agent name + error message
- Provider exhaustion → `AllProvidersExhausted` with retry-after estimate
- No agent-level retry; provider fallback in router only; manual re-run if pipeline fails

## Testing

- **Backend**: pytest. Unit tests per agent (mock LLM responses). Pipeline integration test with real SQLite.
- **Frontend**: Vitest. Component render tests, API mock tests. No E2E in Phase 1.

## Startup Workflows

Phase 1 ships with 3 workflows:

1. **AI Tool Explainer** — hook-driven explainers for AI tools and concepts
2. **Facts/Curiosity** — surprising facts, short-form curiosity content
3. **Clean Faceless Productivity** — minimalist productivity/how-to content

## Phase Structure

| Phase | Scope |
|---|---|
| 1 (this spec) | App skeleton, channels, workflow registry, skill registry, agent pipeline, manual package generation, growth scoring, QA, approval gate |
| 2 (future) | Reference video upload, style profile generation, Master Router Agent |
| 3 (future) | Episode Flow Agent, series planning, episode scoring |
| 4 (future) | Reference Intelligence Agent, YouTube public pattern analysis |
| 5 (future) | YouTube Analytics API, channel performance learning, next video recommendation |

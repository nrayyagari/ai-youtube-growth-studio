# Monetization Ecosystem — Design Spec

**Date:** 2026-06-09
**Status:** Approved
**Scope:** SaaS monetization + owned YouTube channels ecosystem

---

## Summary

Transform the AI YouTube Growth Studio from a single-user local tool into a revenue-generating ecosystem with two engines: a freemium SaaS platform for YouTube creators, and a portfolio of owned YouTube channels that serve as marketing proof and feed the AI learning loop.

**Two engines that feed each other:** SaaS generates immediate revenue; owned channels provide social proof and validation data. Both use the same core AI pipeline.

---

## Constraints

- **Cost target:** \$6–16/month infrastructure total at launch
- **Free AI tiers only** for compute (Gemini 2.0 Flash, Groq Llama 3.3 70B, Cerebras Llama 3.3 70B)
- **Reuse existing codebase** — no rewrite, surgical additions only
- **Single-developer maintainable** — no microservices, no Kubernetes
- **SQLite only** — no PostgreSQL migration needed at this scale
- **Human review + manual production** for owned channels (not full auto-publish)

---

## Architecture

### Current → Target Delta

```
BEFORE (Single-User Tool)
─────────────────────────
Browser → FastAPI (:8000) → SQLite
          └─ 14 agents + router

AFTER (Multi-Tenant SaaS)
─────────────────────────
Browser → FastAPI (:8000)
            ├─ Auth middleware (Clerk)
            ├─ Stripe billing
            ├─ Tier enforcement
            ├─ 14 agents + router
            └─ SQLite (+users, +subscriptions)
```

### Multi-Tenancy

Add `user_id` (TEXT, FK to users.id) to the `channels` table. All other tables (packages, series, analytics, calendar, etc.) chain through `channel_id`. Auth middleware reads `X-Clerk-User-Id` from verified JWT and injects into request context. All queries automatically scoped by user's channels.

### New Tables

```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    subscription_tier TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    status TEXT DEFAULT 'inactive',
    current_period_end TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### New Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/webhook | Clerk user create/update |
| GET | /api/user/me | Current user + subscription |
| POST | /api/stripe/checkout | Create checkout session |
| POST | /api/stripe/webhook | Stripe event handler |
| GET | /api/user/usage | Usage vs tier limits |

### Unauthenticated Frontend Routes

| Route | Purpose |
|-------|---------|
| / | Landing page |
| /pricing | Pricing page |
| /login | Clerk sign-in redirect |
| /signup | Clerk sign-up redirect |

All existing pages (/dashboard, /generator, etc.) become authenticated routes.

---

## Pricing Tiers

|  | Free | Pro | Agency |
|---|---|---|---|
| **Price** | \$0 | \$19/mo | \$49/mo |
| **Packages/month** | 3 | Unlimited | Unlimited |
| **Channels** | 1 | 3 | 20 |
| **Core agents** | 7 | 7 | 7 |
| **Advanced agents** | No | 7 | 7 |
| **YouTube Analytics** | No | Yes | Yes |
| **Batch generate** | No | No | Yes |
| **Competitor analysis** | No | No | Yes |

Enforcement: middleware checks `users.subscription_tier` + usage counters on each request. Free tier usage resets on billing cycle (monthly).

---

## Owned Channels Strategy

### Phase 1 (Month 1–3): One Channel

- **Niche:** AI & Tech Explainers (built-in workflow, good CPM, directly proves SaaS value)
- **Goal:** 1,000 subscribers, 20K views/month
- **Content:** AI-generated explainers with human review and manual video assembly

### Phase 2 (Month 3–6): Expand

- Add 1–2 more channels (Facts/Curiosity, Productivity)
- Reuse proven workflows
- Goal: YPP monetized, \$200–500/month ad revenue

### Phase 3 (Month 6+): Portfolio

- Scale to 5+ channels across niches
- Revenue diversifies (ads + sponsorships + own product promos)

### Weekly Schedule per Channel

```
Mon: AI generates 5-7 ideas → human picks best 3
Tue: Run full pipeline on 3 selected → review scripts
Wed: TTS voiceover + visual assembly
Thu: Generate thumbnails + titles → human picks
Fri: Final review, SEO optimization, schedule
Sat/Sun: Publish 2-3 videos
```

### Channels → SaaS Flywheel

- Every video description links to the SaaS
- Monthly "behind the scenes" video showing the tool
- Analytics data from owned channels feeds the performance learning loop (benefits all users)
- Channel growth = marketing content ("I grew this channel using AI")

---

## Go-To-Market

### Build Phase (Week 1–2)
- Auth integration (Clerk)
- Stripe checkout + webhooks
- Landing page + pricing page
- Production deploy (VPS + domain + SSL)

### Soft Launch (Week 3)
- Reddit posts (r/YouTubers, r/SideProject, r/SaaS)
- X / LinkedIn announcement
- Product Hunt launch
- Target: 10–50 free signups

### Content-Led Growth (Week 4+)
- Owned YouTube channel publishes first AI-generated videos
- Blog posts: "How I automated my YouTube channel with AI"
- Target: 100+ free users, first paid conversions

### Paid Growth (Month 3+)
- Google Ads for "AI YouTube tool" keywords
- Sponsor small YouTube creator channels
- Target: 50+ paid users, \$950+ MRR

---

## Revenue Projections (Conservative)

| Month | Free Users | Paid Users | MRR | Channel Rev | Total |
|-------|-----------|------------|-----|-------------|-------|
| 1 | 100 | 5 | \$95 | \$0 | \$95 |
| 2 | 300 | 15 | \$285 | \$0 | \$285 |
| 3 | 500 | 30 | \$570 | \$0 | \$570 |
| 6 | 1,500 | 100 | \$1,900 | \$200 | \$2,100 |
| 12 | 5,000 | 300 | \$5,700 | \$800 | \$6,500 |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Free AI tiers rate-limited at scale | Multi-provider fallback already built; add paid OpenAI as backstop |
| Channel never gains traction | Pivot niche after 3 months; tool works regardless |
| Competitors copy free-AI approach | Learning loop is the moat — improves with real channel data |
| YouTube policy changes on AI content | QA agent already checks monetization compliance |
| Low conversion free → paid | Free tier genuinely useful but clearly limited; iterate on limits |

---

## Testing

- **Backend:** Unit tests for tier enforcement middleware, auth middleware, Stripe webhook handler
- **Frontend:** Render tests for landing page, pricing page, authenticated vs unauthenticated routing
- **Integration:** End-to-end flow — signup → generate → hit limits → upgrade → continue

# Channel Settings Cleanup — Design Spec

**Date:** 2026-06-09
**Status:** Approved
**Scope:** Remove dead channel fields, simplify Generator, add language preference

---

## Summary

Remove 5 channel fields that agents never use or that are irrelevant for a script-generation tool. Simplify the Generator to 3 fields (name, language, topic). Slim Settings Channel tab to 4 fields. Delete unused ChannelForm component.

---

## Problem

Current channel schema has 11 columns. Agents use only 4 (name, niche, audience, language). The other 7 are database noise that pollutes the UI. Additionally, "niche" is YouTube insider jargon that confuses non-creator users — the AI can derive it from the topic.

---

## What Agents Actually Use

| Field | IdeaAgent | ScriptAgent | Drives script quality? |
|-------|-----------|-------------|----------------------|
| `name` | No | Yes | Marginal |
| `niche` | Yes | Yes | **Critical** |
| `audience` | Yes | Yes | **Critical** |
| `language` | Yes | Yes | **Critical** |

---

## What Gets Removed from UI

| Field | Why removed |
|-------|------------|
| `monetization_goal` | QA agent handles monetization silently. Doesn't change script output. |
| `upload_frequency` | Was for Calendar — already removed from UI. |
| `content_mode` | Was for Series Planner — already removed from UI. |
| `target_country` | No agent reads it. Country is implied by language. |
| `banned_topics` | Never used by any agent code. Premature feature. |

**Database columns stay** — no migration. Just don't render them.

---

## Generator Page (`/generate`)

The only page a zero-knowledge user needs. Three fields:

```
Channel name: [_________]          (required)
Language:     [English ▾]         (default: English)
Topic:        [_________________] (optional — AI suggests if blank)
              [Generate Script →]
```

### Language Dropdown
- English (default)
- Hindi
- Spanish
- French
- German

### Behavior
- Channel name is required. Creates a channel record on first generation.
- Language defaults to English. When user picks a different language, scripts/titles/SEO are generated in that language.
- Topic is optional — blank triggers IdeaAgent to generate one.
- Niche and Audience are NOT asked here. The AI derives them from the topic.

---

## Settings → Channel Tab

For power users who want more control:

```
Name:     [_________]
Niche:    [_________] (optional)
Audience: [_________] (optional)
Language: [English ▾]
```

4 fields. Niche and Audience are optional — leave blank, AI figures it out. Language is shared with Generator dropdown.

---

## Files Changed

| File | Action |
|------|--------|
| `pages/Generator.tsx` | Add language dropdown, remove unused fields, simplify to 3 inputs |
| `pages/Settings.tsx` | Channel tab: remove Upload Frequency + Monetization Goal fields, keep 4 |
| `components/forms/ChannelForm.tsx` | **Delete** — no page imports it anymore |

---

## Files Unchanged

- `backend/core/database.py` — columns stay
- `backend/routes/channels.py` — routes unchanged
- `backend/agents/` — no agent changes
- All other pages

---

## Self-Review

- No placeholders or TBDs
- No contradictions — agents use exactly the fields we expose
- Scope focused — 3 files changed, 1 deleted
- No ambiguity — every removed field has a documented reason

# Spec: Settings UX Overhaul + Provider Expansion

**Date:** 2026-06-13
**Status:** Approved

## 1. Add 5 API Providers

### Backend
- `config.py`: add `anthropic_api_key`, `mistral_api_key`, `together_api_key`, `cohere_api_key`, `xai_api_key` env vars (default `""`)
- `router.py` `PROVIDERS` dict: add 5 entries:

| Provider | Model | RPM | Endpoint |
|---|---|---|---|
| anthropic | claude-3-5-sonnet-latest | 50 | `https://api.anthropic.com/v1/messages` |
| mistral | mistral-large-latest | 30 | `https://api.mistral.ai/v1/chat/completions` |
| together | meta-llama/Llama-3.3-70B-Instruct-Turbo | 60 | `https://api.together.xyz/v1/chat/completions` |
| cohere | command-r-plus | 40 | `https://api.cohere.ai/v1/chat` |
| xai | grok-2-1212 | 20 | `https://api.x.ai/v1/chat/completions` |

- Update `self.ordering` list
- Implement `_call_provider` dispatch for new endpoints (Anthropic uses different header format: `x-api-key` + `anthropic-version`, Cohere uses different response format)

### Frontend
- `types.ts`: add 5 optional fields to `ProviderKeys`
- `Settings.tsx`: add 5 state variables + input rows in the "API Keys" tab

## 2. YouTube Channel URL + Auto-Fetch

### Backend
- New endpoint `GET /api/youtube/resolve-channel?url=https://youtube.com/@channelname`
- Uses `yt-dlp` or YouTube oEmbed to extract channel ID, name, subscriber count, avatar
- Returns `{ channel_id, title, subscriber_count, thumbnail }`
- No auth required (public oEmbed endpoint)

### Frontend
- `types.ts`: `ChannelProfile` gets optional `channel_url: string`
- `Settings.tsx` Channel tab: new input "YouTube Channel URL" with "Fetch" button
- Clicking Fetch calls the backend, auto-fills channel name + niche from fetched data
- Saved as part of channel profile in IndexedDB
- URL passed with analytics calls for channel targeting

## 3. Persistent Save Badges + Delete Icons

### Each input row gets three components inline:

```
[Provider Label]  [Input Field]  [✓ SAVED badge]  [🗑 delete]
```

### Behavior:
- On field edit → badge reverts to "Save" button
- "Save" clicked → badge shows "✓ SAVED" in green (persistent)
- 🗑 clicked → clears the value in IndexedDB + input field, reverts to "Save" button
- Channel profile, Drive client ID use same pattern

### Implementation:
- Introduce a `SaveBadge` component: `{ status: "idle" | "saved" }` + onSave/onDelete callbacks
- Track per-row `saved` state in Settings. On input change → set saved=false. On save → set saved=true.

## 4. YouTube Connect/Disconnect Button States

### State machine:
```
[Credentials Input] [✓ SAVED] [Connect YouTube]   ← initial
    ↓ click Connect
[Credentials Input] [✓ SAVED] [✓ CONNECTED] [Disconnect YouTube]  ← connected
    ↓ click Disconnect
[Credentials Input] [✓ SAVED] [✓ DISCONNECTED]   ← flashes 2s
    ↓
[Credentials Input] [✓ SAVED] [Connect YouTube]   ← back to initial
```

### Implementation:
- `youtubeConnected` state already exists. Use it for conditional rendering.
- After disconnect: set `youtubeDisconnectedSoon` → setTimeout 2s → reset.
- Connected state: show green badge + "Disconnect YouTube" button (red border)

## 5. "Generate first script" Text Wrap Fix

- File: `frontend/src/pages/MyVideos.tsx`
- Line 89: `emptyBtn` style — add `whiteSpace: "nowrap"`
- Also apply to `generateBtn` in Workspace.tsx hero for consistency

## 6. Add `loading` state to buttons

- "Connect YouTube" → shows "Connecting..." while waiting for backend
- "Save API Keys" → shows "Saving..." while waiting
- Each button gets `disabled` + loading text during async operations
- Reuse existing `loading` pattern from Generator.tsx

# YouTube Analytics Setup — Step-by-Step Guide

## Prerequisites

- A Google account that owns or manages a YouTube channel
- The AI YouTube Growth Studio running locally (http://localhost:8000)

---

## Step 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click the project dropdown (top-left, next to "Google Cloud") → **New Project**
3. Name it `youtube-growth-studio` → **Create**
4. Wait for the project to be created, then select it from the dropdown

---

## Step 2: Enable Required APIs

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **YouTube Analytics API** → click it → **Enable**
3. Go back to Library, search for **YouTube Data API v3** → click it → **Enable**

Both must show "API Enabled" with a green checkmark.

---

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (since this is a personal/local app) → **Create**
3. Fill in:
   - App name: `YouTube Growth Studio`
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue** (skip scopes page for now)
5. On "Test users" page, click **Add Users** → add your own email → **Save and Continue**
6. Click **Back to Dashboard**

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Growth Studio Local`
5. Under **Authorized redirect URIs**, click **Add URI** and enter:

   ```
   http://localhost:8000/api/youtube/oauth/callback
   ```

   > **Important:** This must be exactly `http://localhost:8000/api/youtube/oauth/callback`.
   > No trailing slash, no HTTPS.

6. Click **Create**
7. A popup shows your **Client ID** and **Client Secret**. Copy both — you need them in Step 5.

---

## Step 5: Enter Credentials in Growth Studio

1. Open the Growth Studio app at http://localhost:8000
2. Go to **Settings** (left sidebar)
3. Scroll to **YouTube Analytics OAuth** section
4. Paste your **Client ID** (looks like `123456789-xxxx.apps.googleusercontent.com`)
5. Paste your **Client Secret** (looks like `GOCSPX-xxxxxxxxxxxxxxxxxxxx`)
6. Click **Connect YouTube**

---

## Step 6: Complete OAuth Authorization

1. A new browser tab opens with Google's sign-in page
2. Sign in with the Google account linked to your YouTube channel
3. Google shows a warning: "This app isn't verified" — this is normal for local apps. Click **Continue**
4. Review the permissions requested:
   - View your YouTube account
   - View YouTube Analytics reports for your channel
5. Click **Allow**
6. You'll be redirected to a page showing `{"status":"connected",...}`
7. Go back to Settings and click **Refresh Status** — it should show **Connected** (green)

---

## Step 7: Sync Analytics Data

1. Go to **Analytics** (left sidebar)
2. Select your channel from the dropdown
3. Click the green **Sync from YouTube** button
4. Wait a few seconds — the system pulls:
   - Channel stats (total views, subscribers, video count)
   - 30-day analytics (daily views, watch time, retention)
   - Top 10 videos by views
   - Demographics (age groups, gender)
5. A success message appears: `Synced: Your Channel Name — 1,234 subs, 50,000 views`

---

## Step 8: View Results

### Analytics Dashboard
- **Snapshots table** — each sync creates a dated snapshot. Compare any two periods.
- **Period Comparison** — shows % change in views, watch time, subs, CTR, retention between last two snapshots.

### Generate Recommendations
- Click **Generate** in the Recommendations panel
- The AI analyzes your analytics + style profile and suggests:
  - What topic to cover next
  - How to improve CTR/retention
  - What format changes to try

---

## Step 9: Ongoing Use

- Each time you click **Sync from YouTube**, it updates today's snapshot (or creates a new one if none exists for today)
- Build up a history: sync daily or weekly to see trends
- The comparison view becomes more meaningful with more snapshots over time

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "This app isn't verified" warning | Normal for local apps. Click Continue. |
| "YouTube not connected" | Go to Settings, re-enter Client ID/Secret, click Connect again |
| "Sync failed: quota exceeded" | YouTube Analytics API has 10,000 queries/day quota. Wait or reduce sync frequency |
| "No analytics data available" | New channels (< 48 hrs old) or channels with < 10 views in 30 days won't return data |
| Redirect URI mismatch | The URI in Google Cloud Console must be exactly `http://localhost:8000/api/youtube/oauth/callback` |
| "invalid_grant" on re-auth | Go to https://myaccount.google.com/permissions, remove Growth Studio, redo Step 6 |

---

## Security Notes

- Your refresh token is stored **locally** in SQLite (`data/growth_studio.db`). It never leaves your machine.
- The app only requests **read-only** YouTube scopes. It cannot modify your channel or videos.
- To revoke access: go to https://myaccount.google.com/permissions → remove "YouTube Growth Studio"

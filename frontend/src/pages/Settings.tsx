import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import { backupToDrive, clearClientId, disconnectDrive, getClientId, getDriveAuthUrl, isDriveConnected, restoreFromDrive, setClientId } from "../lib/drive_sync";

type Tab = "apikeys" | "channel" | "account";

export default function Settings() {
  const { email } = useAuth();
  const [tab, setTab] = useState<Tab>("apikeys");
  const [message, setMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [channelName, setChannelName] = useState("My Channel");
  const [channelNiche, setChannelNiche] = useState("");
  const [channelAudience, setChannelAudience] = useState("General audience");
  const [channelLanguage, setChannelLanguage] = useState("en");
  const [youtubeClientId, setYoutubeClientId] = useState("");
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("");
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveClientId, setDriveClientIdState] = useState("");

  useEffect(() => {
    Promise.all([
      storage.getProviderKeys(),
      storage.getChannelProfile(),
      storage.getYoutubeOAuthConfig(),
      storage.getYoutubeTokens(),
    ]).then(async ([keys, profile, youtubeOauth, youtubeTokens]) => {
      setGeminiKey(keys.gemini || "");
      setGroqKey(keys.groq || "");
      setOpenaiKey(keys.openai || "");
      setChannelName(profile.name);
      setChannelNiche(profile.niche);
      setChannelAudience(profile.audience);
      setChannelLanguage(profile.language);
      setYoutubeClientId(youtubeOauth.client_id || "");
      setYoutubeClientSecret(youtubeOauth.client_secret || "");
      setDriveClientIdState(getClientId());
      setDriveConnected(isDriveConnected());
      if (youtubeTokens?.refresh_token && youtubeOauth.client_id && youtubeOauth.client_secret) {
        try {
          const status = await api.checkYoutubeStatus(youtubeTokens.refresh_token, youtubeOauth.client_id, youtubeOauth.client_secret);
          setYoutubeConnected(!!status.connected);
        } catch {
          setYoutubeConnected(false);
        }
      }
    });
  }, []);

  const handleSaveKeys = async () => {
    await storage.setProviderKeys({
      gemini: geminiKey,
      groq: groqKey,
      openai: openaiKey,
    });
    setMessage("API keys saved locally.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleExportLocalBackup = async () => {
    const blob = await storage.exportAll();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `growth-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Local backup downloaded to your device.");
  };

  const handleImportLocalBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Record<string, unknown>;
      const imported = await storage.importAll(payload as Record<string, any[]>);
      setDriveConnected(isDriveConnected());
      setMessage(imported > 0 ? `Imported ${imported} records from local backup.` : "Backup file was valid but did not contain importable records.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to import backup file.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSaveChannel = async () => {
    await storage.setChannelProfile({
      name: channelName,
      niche: channelNiche,
      audience: channelAudience,
      language: channelLanguage,
    });
    setMessage("Channel settings saved locally.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleConnectDrive = () => {
    const clientId = driveClientId.trim();
    if (!clientId) {
      setMessage("Enter your Google OAuth client ID first.");
      return;
    }
    setClientId(clientId);
    window.location.href = getDriveAuthUrl(clientId);
  };

  const handleSaveYoutube = async () => {
    await storage.setYoutubeOAuthConfig({
      client_id: youtubeClientId,
      client_secret: youtubeClientSecret,
    });
    setMessage("YouTube OAuth credentials saved locally.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleConnectYoutube = async () => {
    if (!youtubeClientId.trim() || !youtubeClientSecret.trim()) {
      setMessage("Enter your YouTube OAuth client ID and secret first.");
      return;
    }
    await storage.setYoutubeOAuthConfig({
      client_id: youtubeClientId.trim(),
      client_secret: youtubeClientSecret.trim(),
    });
    const redirectUri = `${window.location.origin}/youtube/callback`;
    try {
      const payload = await api.getYoutubeOAuthUrl(youtubeClientId.trim(), youtubeClientSecret.trim(), redirectUri);
      window.location.href = payload.auth_url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to start YouTube connect flow.");
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "apikeys", label: "API Keys" },
    { key: "channel", label: "Channel" },
    { key: "account", label: "Account" },
  ];

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Settings</h1>

      <div style={styles.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={tab === t.key ? styles.tabActive : styles.tab}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && <p style={styles.success}>{message}</p>}

      {tab === "apikeys" && (
        <div>
          <h2 style={styles.h2}>AI Providers</h2>
          <p style={styles.hint}>Bring your own API keys. All data stays in your browser.</p>
          <div style={styles.guideCard}>
            <h3 style={styles.cardHeading}>How this works</h3>
            <ol style={styles.steps}>
              <li>Paste one or more provider keys here and save them locally in this browser.</li>
              <li>When you generate a script, the selected key is sent only for that live request.</li>
              <li>Your backend should redact secrets in logs and discard keys as soon as the response returns.</li>
            </ol>
            <p style={styles.smallHint}>Best practical default: add Gemini first, then OpenAI or Groq as fallback providers.</p>
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Gemini API Key <span style={styles.keyHint}>gemini-2.0-flash — 15 RPM free</span></label>
            <input
              type="password"
              placeholder={geminiKey ? "•••• configured" : "Enter key"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Groq API Key <span style={styles.keyHint}>Llama 3.3 70B — 30 RPM free</span></label>
            <input
              type="password"
              placeholder={groqKey ? "•••• configured" : "Enter key"}
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>OpenAI API Key <span style={styles.keyHint}>Optional fallback provider</span></label>
            <input
              type="password"
              placeholder={openaiKey ? "•••• configured" : "Enter key"}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              style={styles.input}
            />
          </div>
          <button onClick={handleSaveKeys} style={styles.primaryBtn}>Save API Keys</button>
        </div>
      )}

      {tab === "channel" && (
        <div>
          <h2 style={styles.h2}>Channel Profile</h2>
          <div style={styles.guideCard}>
            <h3 style={styles.cardHeading}>Recommended setup order</h3>
            <ol style={styles.steps}>
              <li>Save your basic channel profile so the agent knows your niche and audience.</li>
              <li>Paste your Google OAuth client ID and secret for YouTube in this browser only.</li>
              <li>Use the redirect URI below in Google Cloud, then connect YouTube and refresh analytics.</li>
            </ol>
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Channel Name</label>
            <input value={channelName} onChange={(e) => setChannelName(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Niche</label>
            <input value={channelNiche} onChange={(e) => setChannelNiche(e.target.value)} placeholder="e.g. Tech, Education, Gaming" style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Audience</label>
            <input value={channelAudience} onChange={(e) => setChannelAudience(e.target.value)} placeholder="e.g. Founders, Students, Busy professionals" style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Language</label>
            <input value={channelLanguage} onChange={(e) => setChannelLanguage(e.target.value)} placeholder="en" style={styles.input} />
          </div>
          <button onClick={handleSaveChannel} style={styles.primaryBtn}>Save Channel</button>

          <div style={styles.integrationCard}>
            <h2 style={styles.h2}>YouTube Connection</h2>
            <p style={styles.hint}>Keep your YouTube OAuth credentials and refresh token only in this browser.</p>
            <div style={styles.keyRow}>
              <label style={styles.keyLabel}>YouTube OAuth Client ID</label>
              <input value={youtubeClientId} onChange={(e) => setYoutubeClientId(e.target.value)} placeholder="Paste your Google OAuth client ID" style={styles.input} />
            </div>
            <div style={styles.keyRow}>
              <label style={styles.keyLabel}>YouTube OAuth Client Secret</label>
              <input type="password" value={youtubeClientSecret} onChange={(e) => setYoutubeClientSecret(e.target.value)} placeholder="Paste your Google OAuth client secret" style={styles.input} />
            </div>
            <p style={styles.smallHint}>Redirect URI to configure in Google Cloud: <code style={styles.code}>{window.location.origin}/youtube/callback</code></p>
            <p style={styles.smallHint}>Status: {youtubeConnected ? "Connected" : "Not connected in this browser"}</p>
            <p style={styles.smallHint}>Needed Google APIs: YouTube Data API v3 and YouTube Analytics API.</p>
            <div style={styles.accountActions}>
              <button onClick={handleSaveYoutube} style={styles.secondaryBtn}>Save YouTube Credentials</button>
              <button onClick={handleConnectYoutube} style={styles.primaryBtnInline}>
                {youtubeConnected ? "Reconnect YouTube" : "Connect YouTube"}
              </button>
              <button onClick={async () => {
                await storage.setYoutubeTokens(null);
                await storage.setAnalyticsCache({});
                setYoutubeConnected(false);
                setMessage("YouTube disconnected from this browser.");
              }} style={styles.secondaryBtn}>
                Disconnect YouTube
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "account" && (
        <div>
          <h2 style={styles.h2}>Account</h2>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Email</label>
            <input value={email || ""} disabled style={{ ...styles.input, opacity: 0.5 }} />
          </div>
          <p style={styles.hint}>All data is stored in your browser. No server-side storage.</p>
          <div style={styles.accountCard}>
            <p style={styles.accountText}>Workspace status</p>
            <div style={styles.statusGrid}>
              <StatusPill label="AI keys" active={Boolean(geminiKey || groqKey || openaiKey)} />
              <StatusPill label="YouTube OAuth" active={Boolean(youtubeClientId && youtubeClientSecret)} />
              <StatusPill label="YouTube connected" active={youtubeConnected} />
              <StatusPill label="Drive backup" active={driveConnected} />
            </div>
          </div>
          <div style={styles.accountCard}>
            <p style={styles.accountText}>Google Drive backup: {driveConnected ? "Connected" : "Not connected in this browser session"}</p>
            <p style={styles.smallHint}>Use Drive if you want cloud backup without your server storing workspace data. Use local export if you prefer a file on your own machine.</p>
            <div style={styles.keyRow}>
              <label style={styles.keyLabel}>Google OAuth Client ID</label>
              <input
                value={driveClientId}
                onChange={(e) => setDriveClientIdState(e.target.value)}
                placeholder="Paste your Google OAuth client ID"
                style={styles.input}
              />
              <p style={styles.smallHint}>Stored only in this browser so users can back up to their own Drive.</p>
            </div>
            <div style={styles.accountActions}>
              <button onClick={handleConnectDrive} style={styles.primaryBtnInline}>
                {driveConnected ? "Reconnect Drive" : "Connect Drive"}
              </button>
              <button onClick={async () => {
                const ok = await backupToDrive();
                setMessage(ok ? "Workspace backed up to your Google Drive." : "Drive backup failed. Connect Drive in this browser first.");
              }} style={styles.secondaryBtn}>
                Backup Now
              </button>
              <button onClick={async () => {
                const ok = await restoreFromDrive();
                setMessage(ok ? "Workspace restored from your Google Drive." : "Drive restore failed.");
              }} style={styles.secondaryBtn}>
                Restore
              </button>
              <button onClick={() => { disconnectDrive(); setDriveConnected(false); clearClientId(); setDriveClientIdState(""); setMessage("Drive disconnected."); }} style={styles.secondaryBtn}>
                Disconnect Drive
              </button>
            </div>
          </div>
          <div style={styles.accountCard}>
            <p style={styles.accountText}>Local backup</p>
            <p style={styles.smallHint}>Export everything from IndexedDB into a JSON file, or restore it later in this same browser or another browser.</p>
            <div style={styles.accountActions}>
              <button onClick={handleExportLocalBackup} style={styles.primaryBtnInline}>
                Download Backup
              </button>
              <button onClick={() => importInputRef.current?.click()} style={styles.secondaryBtn}>
                Import Backup File
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportLocalBackup}
                style={{ display: "none" }}
              />
            </div>
          </div>
          <button onClick={async () => { await storage.clearAll(); setMessage("Local data cleared."); }} style={styles.dangerBtn}>
            Clear Local Data
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ ...styles.statusPill, borderColor: active ? "#14532d" : "#333", background: active ? "rgba(34,197,94,0.12)" : "#11111c" }}>
      <span style={{ ...styles.statusDot, background: active ? "#4ade80" : "#666" }} />
      <span>{label}: {active ? "Ready" : "Missing"}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: "0 auto", padding: "40px 32px" },
  h1: { fontSize: 28, color: "#fff", marginBottom: 24 },
  h2: { fontSize: 18, color: "#ddd", marginBottom: 12 },
  hint: { color: "#777", fontSize: 13, marginBottom: 16 },
  tabBar: { display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #333" },
  tab: { padding: "10px 18px", background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 14, borderBottom: "2px solid transparent" },
  tabActive: { padding: "10px 18px", background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 14, borderBottom: "2px solid #e94560", fontWeight: 600 },
  keyRow: { marginBottom: 16 },
  keyLabel: { display: "block", color: "#ccc", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  keyHint: { display: "block", color: "#666", fontSize: 12, fontWeight: 400, marginTop: 2 },
  input: { display: "block", width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, boxSizing: "border-box" },
  primaryBtn: { marginTop: 16, padding: "12px 24px", borderRadius: 6, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  primaryBtnInline: { padding: "10px 14px", borderRadius: 6, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  secondaryBtn: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#12121d", color: "#ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  dangerBtn: { marginTop: 16, padding: "12px 24px", borderRadius: 6, border: "1px solid #e94560", background: "transparent", color: "#e94560", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  success: { color: "#4ade80", fontSize: 14, marginBottom: 12 },
  accountCard: { marginTop: 16, padding: 16, borderRadius: 10, border: "1px solid #333", background: "#141421" },
  integrationCard: { marginTop: 24, padding: 16, borderRadius: 10, border: "1px solid #333", background: "#141421" },
  guideCard: { marginBottom: 20, padding: 16, borderRadius: 10, border: "1px solid #2f3344", background: "#11131d" },
  cardHeading: { margin: "0 0 10px", color: "#f3f4f6", fontSize: 15 },
  accountText: { color: "#ccc", fontSize: 13, margin: "0 0 12px" },
  accountActions: { display: "flex", flexWrap: "wrap", gap: 10 },
  smallHint: { color: "#666", fontSize: 12, margin: "6px 0 0" },
  code: { color: "#cbd5e1", background: "#11111c", padding: "2px 6px", borderRadius: 4 },
  steps: { margin: "0 0 0 18px", padding: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 },
  statusGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  statusPill: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 999, border: "1px solid #333", color: "#d4d4d8", fontSize: 12, fontWeight: 600 },
  statusDot: { width: 8, height: 8, borderRadius: 999 },
};

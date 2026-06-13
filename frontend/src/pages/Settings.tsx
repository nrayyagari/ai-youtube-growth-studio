import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import { backupToDrive, clearClientId, disconnectDrive, getClientId, getDriveAuthUrl, isDriveConnected, restoreFromDrive, setClientId } from "../lib/drive_sync";
import type { ProviderKeys } from "../lib/types";

type Tab = "apikeys" | "channel" | "account";

const PROVIDERS: { key: keyof ProviderKeys; label: string; hint: string }[] = [
  { key: "gemini", label: "Gemini API Key", hint: "gemini-2.0-flash — 15 RPM free" },
  { key: "groq", label: "Groq API Key", hint: "Llama 3.3 70B — 30 RPM free" },
  { key: "cerebras", label: "Cerebras API Key", hint: "Llama 3.3 70B — 30 RPM free" },
  { key: "deepseek", label: "DeepSeek API Key", hint: "DeepSeek V3 — 60 RPM" },
  { key: "openai", label: "OpenAI API Key", hint: "GPT-4o mini — 100 RPM" },
  { key: "anthropic", label: "Anthropic API Key", hint: "Claude 3.5 Sonnet — 50 RPM" },
  { key: "mistral", label: "Mistral API Key", hint: "Mistral Large — 30 RPM" },
  { key: "together", label: "Together AI API Key", hint: "Llama 3.3 70B — 60 RPM" },
  { key: "cohere", label: "Cohere API Key", hint: "Command R+ — 40 RPM" },
  { key: "xai", label: "xAI API Key", hint: "Grok 2 — 20 RPM" },
];

export default function Settings() {
  const { email } = useAuth();
  const [tab, setTab] = useState<Tab>("apikeys");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [providerKeys, setProviderKeys] = useState<ProviderKeys>({});
  const [savedProviderKeys, setSavedProviderKeys] = useState<Record<string, boolean>>({});
  const [savingProviderKeys, setSavingProviderKeys] = useState<Record<string, boolean>>({});

  const [channelName, setChannelName] = useState("My Channel");
  const [channelNiche, setChannelNiche] = useState("");
  const [channelAudience, setChannelAudience] = useState("General audience");
  const [channelLanguage, setChannelLanguage] = useState("en");
  const [channelUrl, setChannelUrl] = useState("");
  const [isChannelSaved, setIsChannelSaved] = useState(false);
  const [isChannelSaving, setIsChannelSaving] = useState(false);
  const [isFetchingChannel, setIsFetchingChannel] = useState(false);

  const [youtubeClientId, setYoutubeClientId] = useState("");
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("");
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeDisconnected, setYoutubeDisconnected] = useState(false);
  const [youtubeSaving, setYoutubeSaving] = useState(false);
  const [youtubeConnecting, setYoutubeConnecting] = useState(false);
  const [youtubeDisconnecting, setYoutubeDisconnecting] = useState(false);

  const [driveConnected, setDriveConnected] = useState(false);
  const [driveClientId, setDriveClientIdState] = useState("");

  useEffect(() => {
    Promise.all([
      storage.getProviderKeys(),
      storage.getChannelProfile(),
      storage.getYoutubeOAuthConfig(),
      storage.getYoutubeTokens(),
    ]).then(async ([keys, profile, youtubeOauth, youtubeTokens]) => {
      setProviderKeys(keys);
      setSavedProviderKeys(
        Object.fromEntries(
          PROVIDERS.map((p) => [p.key, Boolean(keys[p.key])])
        )
      );
      setChannelName(profile.name);
      setChannelNiche(profile.niche);
      setChannelAudience(profile.audience);
      setChannelLanguage(profile.language);
      setChannelUrl(profile.channel_url || "");
      setIsChannelSaved(
        Boolean((profile.name && profile.name !== "My Channel") || profile.channel_url)
      );
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

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage("");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage("");
    setTimeout(() => setErrorMessage(""), 5000);
  };

  const handleProviderKeyChange = (key: keyof ProviderKeys, value: string) => {
    setProviderKeys((prev) => ({ ...prev, [key]: value }));
    setSavedProviderKeys((prev) => ({ ...prev, [key]: false }));
  };

  const handleSaveProviderKey = async (key: keyof ProviderKeys) => {
    setSavingProviderKeys((prev) => ({ ...prev, [key]: true }));
    await storage.setProviderKeys({ ...providerKeys });
    setSavedProviderKeys((prev) => ({ ...prev, [key]: true }));
    setSavingProviderKeys((prev) => ({ ...prev, [key]: false }));
    showSuccess(`${PROVIDERS.find((p) => p.key === key)?.label} saved.`);
  };

  const handleDeleteProviderKey = async (key: keyof ProviderKeys) => {
    const next = { ...providerKeys, [key]: "" };
    setProviderKeys(next);
    await storage.setProviderKeys(next);
    setSavedProviderKeys((prev) => ({ ...prev, [key]: false }));
    showSuccess(`${PROVIDERS.find((p) => p.key === key)?.label} cleared.`);
  };

  const handleSaveChannel = async () => {
    setIsChannelSaving(true);
    await storage.setChannelProfile({
      name: channelName,
      niche: channelNiche,
      audience: channelAudience,
      language: channelLanguage,
      channel_url: channelUrl,
    });
    setIsChannelSaved(true);
    setIsChannelSaving(false);
    showSuccess("Channel profile saved.");
  };

  const handleDeleteChannelUrl = async () => {
    setChannelUrl("");
    await storage.setChannelProfile({
      name: channelName,
      niche: channelNiche,
      audience: channelAudience,
      language: channelLanguage,
      channel_url: "",
    });
    setIsChannelSaved(false);
    showSuccess("Channel URL cleared.");
  };

  const handleFetchChannel = async () => {
    if (!channelUrl.trim()) {
      showError("Enter a YouTube channel URL first.");
      return;
    }
    setIsFetchingChannel(true);
    try {
      const info = await api.resolveChannelUrl(channelUrl.trim());
      if (info.title) setChannelName(info.title);
      if (info.description) setChannelNiche(info.description.slice(0, 80));
      setIsChannelSaved(false);
      showSuccess(`Fetched: ${info.title}`);
    } catch (err: any) {
      showError(err.message || "Could not fetch channel info.");
    } finally {
      setIsFetchingChannel(false);
    }
  };

  const handleSaveYoutube = async () => {
    setYoutubeSaving(true);
    await storage.setYoutubeOAuthConfig({
      client_id: youtubeClientId,
      client_secret: youtubeClientSecret,
    });
    setYoutubeSaving(false);
    showSuccess("YouTube OAuth credentials saved.");
  };

  const handleDeleteYoutubeCredentials = async () => {
    setYoutubeClientId("");
    setYoutubeClientSecret("");
    await storage.setYoutubeOAuthConfig({ client_id: "", client_secret: "" });
    showSuccess("YouTube credentials cleared.");
  };

  const handleConnectYoutube = async () => {
    if (!youtubeClientId.trim() || !youtubeClientSecret.trim()) {
      showError("Enter your YouTube OAuth client ID and secret first.");
      return;
    }
    setYoutubeConnecting(true);
    try {
      await storage.setYoutubeOAuthConfig({
        client_id: youtubeClientId.trim(),
        client_secret: youtubeClientSecret.trim(),
      });
      const redirectUri = `${window.location.origin}/youtube/callback`;
      const payload = await api.getYoutubeOAuthUrl(youtubeClientId.trim(), youtubeClientSecret.trim(), redirectUri);
      window.location.href = payload.auth_url;
    } catch (err: any) {
      showError(err.message || "Failed to start YouTube connect flow.");
    } finally {
      setYoutubeConnecting(false);
    }
  };

  const handleDisconnectYoutube = async () => {
    setYoutubeDisconnecting(true);
    await storage.setYoutubeTokens(null);
    await storage.setAnalyticsCache({});
    setYoutubeConnected(false);
    setYoutubeDisconnecting(false);
    setYoutubeDisconnected(true);
    showSuccess("YouTube disconnected.");
    setTimeout(() => setYoutubeDisconnected(false), 2000);
  };

  const handleSaveKeys = async () => {
    setSavingProviderKeys(
      Object.fromEntries(PROVIDERS.map((p) => [p.key, true]))
    );
    await storage.setProviderKeys({ ...providerKeys });
    setSavedProviderKeys(
      Object.fromEntries(PROVIDERS.map((p) => [p.key, Boolean(providerKeys[p.key])]))
    );
    setSavingProviderKeys({});
    showSuccess("All API keys saved.");
  };

  const handleExportLocalBackup = async () => {
    const blob = await storage.exportAll();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `growth-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showSuccess("Local backup downloaded to your device.");
  };

  const handleImportLocalBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Record<string, unknown>;
      const imported = await storage.importAll(payload as Record<string, any[]>);
      setDriveConnected(isDriveConnected());
      showSuccess(imported > 0 ? `Imported ${imported} records from local backup.` : "Backup file was valid but did not contain importable records.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to import backup file.");
    } finally {
      event.target.value = "";
    }
  };

  const handleConnectDrive = () => {
    const clientId = driveClientId.trim();
    if (!clientId) {
      showError("Enter your Google OAuth client ID first.");
      return;
    }
    setClientId(clientId);
    window.location.href = getDriveAuthUrl(clientId);
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

      {successMessage && <p style={styles.success}>{successMessage}</p>}
      {errorMessage && <p style={styles.error}>{errorMessage}</p>}

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

          {PROVIDERS.map((provider) => (
            <div key={provider.key} style={styles.keyRow}>
              <div style={styles.keyHeader}>
                <label style={styles.keyLabel}>{provider.label}</label>
                <span style={styles.keyHint}>{provider.hint}</span>
              </div>
              <div style={styles.inputActions}>
                <input
                  type="password"
                  placeholder={providerKeys[provider.key] ? "•••• configured" : "Enter key"}
                  value={providerKeys[provider.key] || ""}
                  onChange={(e) => handleProviderKeyChange(provider.key, e.target.value)}
                  style={styles.input}
                />
                {savedProviderKeys[provider.key] ? (
                  <>
                    <span style={styles.savedBadge}>✓ Saved</span>
                    <button
                      onClick={() => handleDeleteProviderKey(provider.key)}
                      style={styles.deleteBtn}
                      title="Clear key"
                    >
                      🗑
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleSaveProviderKey(provider.key)}
                    disabled={savingProviderKeys[provider.key]}
                    style={styles.smallPrimaryBtn}
                  >
                    {savingProviderKeys[provider.key] ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            </div>
          ))}

          <button onClick={handleSaveKeys} style={styles.primaryBtn}>
            Save All API Keys
          </button>
        </div>
      )}

      {tab === "channel" && (
        <div>
          <h2 style={styles.h2}>Channel Profile</h2>
          <div style={styles.guideCard}>
            <h3 style={styles.cardHeading}>Recommended setup order</h3>
            <ol style={styles.steps}>
              <li>Save your basic channel profile so the agent knows your niche and audience.</li>
              <li>Paste your YouTube channel URL and click Fetch to auto-fill profile details.</li>
              <li>Add your Google OAuth client ID and secret for analytics, then connect YouTube.</li>
            </ol>
          </div>

          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Channel Name</label>
            <input value={channelName} onChange={(e) => { setChannelName(e.target.value); setIsChannelSaved(false); }} style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>YouTube Channel URL</label>
            <div style={styles.inputActions}>
              <input
                value={channelUrl}
                onChange={(e) => { setChannelUrl(e.target.value); setIsChannelSaved(false); }}
                placeholder="https://youtube.com/@yourchannel"
                style={styles.input}
              />
              <button
                onClick={handleFetchChannel}
                disabled={isFetchingChannel}
                style={styles.secondaryBtn}
              >
                {isFetchingChannel ? "Fetching..." : "Fetch"}
              </button>
            </div>
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Niche</label>
            <input value={channelNiche} onChange={(e) => { setChannelNiche(e.target.value); setIsChannelSaved(false); }} placeholder="e.g. Tech, Education, Gaming" style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Audience</label>
            <input value={channelAudience} onChange={(e) => { setChannelAudience(e.target.value); setIsChannelSaved(false); }} placeholder="e.g. Founders, Students, Busy professionals" style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Language</label>
            <input value={channelLanguage} onChange={(e) => { setChannelLanguage(e.target.value); setIsChannelSaved(false); }} placeholder="en" style={styles.input} />
          </div>
          <div style={styles.inputActions}>
            <button onClick={handleSaveChannel} disabled={isChannelSaving} style={styles.primaryBtn}>
              {isChannelSaving ? "Saving..." : isChannelSaved ? "✓ Saved" : "Save Channel"}
            </button>
            {channelUrl && (
              <button onClick={handleDeleteChannelUrl} style={styles.deleteBtn} title="Clear channel URL">
                🗑 Clear URL
              </button>
            )}
          </div>

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
            <p style={styles.smallHint}>Needed Google APIs: YouTube Data API v3 and YouTube Analytics API.</p>
            <div style={styles.accountActions}>
              {youtubeConnected ? (
                <>
                  <span style={styles.savedBadge}>✓ Connected</span>
                  <button
                    onClick={handleDisconnectYoutube}
                    disabled={youtubeDisconnecting}
                    style={styles.disconnectBtn}
                  >
                    {youtubeDisconnecting ? "Disconnecting..." : youtubeDisconnected ? "✓ Disconnected" : "Disconnect YouTube"}
                  </button>
                  <button onClick={handleSaveYoutube} disabled={youtubeSaving} style={styles.secondaryBtn}>
                    {youtubeSaving ? "Saving..." : "Save Credentials"}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleSaveYoutube} disabled={youtubeSaving} style={styles.secondaryBtn}>
                    {youtubeSaving ? "Saving..." : "Save YouTube Credentials"}
                  </button>
                  <button
                    onClick={handleConnectYoutube}
                    disabled={youtubeConnecting}
                    style={styles.primaryBtnInline}
                  >
                    {youtubeConnecting ? "Connecting..." : "Connect YouTube"}
                  </button>
                  {(youtubeClientId || youtubeClientSecret) && (
                    <button onClick={handleDeleteYoutubeCredentials} style={styles.deleteBtn} title="Clear credentials">
                      🗑
                    </button>
                  )}
                </>
              )}
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
              <StatusPill label="AI keys" active={PROVIDERS.some((p) => providerKeys[p.key])} />
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
                showSuccess(ok ? "Workspace backed up to your Google Drive." : "Drive backup failed. Connect Drive in this browser first.");
              }} style={styles.secondaryBtn}>
                Backup Now
              </button>
              <button onClick={async () => {
                const ok = await restoreFromDrive();
                showSuccess(ok ? "Workspace restored from your Google Drive." : "Drive restore failed.");
              }} style={styles.secondaryBtn}>
                Restore
              </button>
              <button onClick={() => { disconnectDrive(); setDriveConnected(false); clearClientId(); setDriveClientIdState(""); showSuccess("Drive disconnected."); }} style={styles.secondaryBtn}>
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
          <button onClick={async () => { await storage.clearAll(); showSuccess("Local data cleared."); }} style={styles.dangerBtn}>
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
  success: { color: "#4ade80", fontSize: 14, marginBottom: 12, fontWeight: 600 },
  error: { color: "#f87171", fontSize: 14, marginBottom: 12, fontWeight: 600 },
  keyRow: { marginBottom: 16 },
  keyHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  keyLabel: { display: "block", color: "#ccc", fontSize: 13, fontWeight: 600 },
  keyHint: { color: "#666", fontSize: 11, fontWeight: 400 },
  input: { display: "block", width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, boxSizing: "border-box" },
  inputActions: { display: "flex", gap: 10, alignItems: "center", marginTop: 4 },
  savedBadge: { color: "#4ade80", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" },
  deleteBtn: { padding: "8px 10px", borderRadius: 6, border: "1px solid #444", background: "#12121d", color: "#f87171", cursor: "pointer", fontSize: 13 },
  smallPrimaryBtn: { padding: "8px 14px", borderRadius: 6, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" },
  primaryBtn: { marginTop: 16, padding: "12px 24px", borderRadius: 6, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  primaryBtnInline: { padding: "10px 14px", borderRadius: 6, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  secondaryBtn: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#12121d", color: "#ddd", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" },
  disconnectBtn: { padding: "10px 14px", borderRadius: 6, border: "1px solid #f87171", background: "#12121d", color: "#f87171", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  dangerBtn: { marginTop: 16, padding: "12px 24px", borderRadius: 6, border: "1px solid #e94560", background: "transparent", color: "#e94560", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  guideCard: { marginBottom: 20, padding: 16, borderRadius: 10, border: "1px solid #2f3344", background: "#11131d" },
  cardHeading: { margin: "0 0 10px", color: "#f3f4f6", fontSize: 15 },
  smallHint: { color: "#666", fontSize: 12, margin: "6px 0 0" },
  code: { color: "#cbd5e1", background: "#11111c", padding: "2px 6px", borderRadius: 4 },
  steps: { margin: "0 0 0 18px", padding: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 },
  accountActions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 },
  accountCard: { marginTop: 16, padding: 16, borderRadius: 10, border: "1px solid #333", background: "#141421" },
  integrationCard: { marginTop: 24, padding: 16, borderRadius: 10, border: "1px solid #333", background: "#141421" },
  accountText: { color: "#ccc", fontSize: 13, margin: "0 0 12px" },
  statusGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  statusPill: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 999, border: "1px solid #333", color: "#d4d4d8", fontSize: 12, fontWeight: 600 },
  statusDot: { width: 8, height: 8, borderRadius: 999 },
};

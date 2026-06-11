import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { storage } from "../lib/storage";
import { backupToDrive, clearClientId, disconnectDrive, getClientId, getDriveAuthUrl, isDriveConnected, restoreFromDrive, setClientId } from "../lib/drive_sync";

type Tab = "apikeys" | "channel" | "account";

export default function Settings() {
  const { email } = useAuth();
  const [tab, setTab] = useState<Tab>("apikeys");
  const [message, setMessage] = useState("");

  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [channelName, setChannelName] = useState("My Channel");
  const [channelNiche, setChannelNiche] = useState("");
  const [channelAudience, setChannelAudience] = useState("General audience");
  const [channelLanguage, setChannelLanguage] = useState("en");
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveClientId, setDriveClientIdState] = useState("");

  useEffect(() => {
    storage.getProviderKeys().then((keys) => {
      setGeminiKey(keys.gemini || "");
      setGroqKey(keys.groq || "");
      setOpenaiKey(keys.openai || "");
    });
    storage.getChannelProfile().then((profile) => {
      setChannelName(profile.name);
      setChannelNiche(profile.niche);
      setChannelAudience(profile.audience);
      setChannelLanguage(profile.language);
    });
    setDriveClientIdState(getClientId());
    setDriveConnected(isDriveConnected());
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
            <p style={styles.accountText}>Google Drive backup: {driveConnected ? "Connected" : "Not connected in this browser session"}</p>
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
          <button onClick={async () => { await storage.clearAll(); setMessage("Local data cleared."); }} style={styles.dangerBtn}>
            Clear Local Data
          </button>
        </div>
      )}
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
  accountText: { color: "#ccc", fontSize: 13, margin: "0 0 12px" },
  accountActions: { display: "flex", flexWrap: "wrap", gap: 10 },
  smallHint: { color: "#666", fontSize: 12, margin: "6px 0 0" },
};

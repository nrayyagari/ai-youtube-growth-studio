import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { storage } from "../lib/storage";

type Tab = "apikeys" | "channel" | "account";

export default function Settings() {
  const { email } = useAuth();
  const [tab, setTab] = useState<Tab>("apikeys");
  const [message, setMessage] = useState("");

  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [channelName, setChannelName] = useState("My Channel");
  const [channelNiche, setChannelNiche] = useState("");

  useEffect(() => {
    storage.getSetting("gemini_api_key").then((v) => { if (v) setGeminiKey(v); });
    storage.getSetting("groq_api_key").then((v) => { if (v) setGroqKey(v); });
    storage.getSetting("channel_name").then((v) => { if (v) setChannelName(v); });
    storage.getSetting("channel_niche").then((v) => { if (v) setChannelNiche(v); });
  }, []);

  const handleSaveKeys = async () => {
    await storage.setSetting("gemini_api_key", geminiKey);
    await storage.setSetting("groq_api_key", groqKey);
    setMessage("API keys saved locally.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSaveChannel = async () => {
    await storage.setSetting("channel_name", channelName);
    await storage.setSetting("channel_niche", channelNiche);
    setMessage("Channel settings saved locally.");
    setTimeout(() => setMessage(""), 3000);
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
  dangerBtn: { marginTop: 16, padding: "12px 24px", borderRadius: 6, border: "1px solid #e94560", background: "transparent", color: "#e94560", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  success: { color: "#4ade80", fontSize: 14, marginBottom: 12 },
};

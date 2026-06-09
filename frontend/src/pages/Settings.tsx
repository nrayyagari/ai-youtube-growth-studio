import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useChannels } from "../hooks/useApi";
import { api } from "../lib/api";

type Tab = "apikeys" | "channel" | "account" | "billing";

export default function Settings() {
  const { user } = useAuth();
  const { channels, loading } = useChannels();
  const [tab, setTab] = useState<Tab>("apikeys");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [channelId, setChannelId] = useState("");
  const [chName, setChName] = useState("");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState("en");
  const [savingChannel, setSavingChannel] = useState(false);

  useEffect(() => {
    api.getApiKeys().then(setKeys).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && channels.length > 0) {
      const c = channels[0];
      setChannelId(String(c.id));
      setChName(c.name);
      setNiche(c.niche);
      setAudience(c.audience);
      setLanguage(c.language);
    }
  }, [channels, loading]);

  const handleSaveKeys = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.updateApiKeys(keyValues);
      const updated = await api.getApiKeys();
      setKeys(updated);
      setKeyValues({});
      setMessage("API keys saved.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChannel = async () => {
    if (!channelId) return;
    setSavingChannel(true);
    setMessage("");
    try {
      await api.updateChannel(Number(channelId), {
        name: chName, niche, audience, language,
      });
      setMessage("Channel updated.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSavingChannel(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "apikeys", label: "API Keys" },
    { key: "channel", label: "Channel" },
    { key: "account", label: "Account" },
    { key: "billing", label: "Billing" },
  ];

  const aiProviders = [
    { key: "gemini_api_key", label: "Gemini API Key", hint: "Gemini 2.0 Flash — 15 RPM free" },
    { key: "grok_api_key", label: "Groq API Key", hint: "Llama 3.3 70B — 30 RPM free" },
    { key: "cerebras_api_key", label: "Cerebras API Key", hint: "Llama 3.3 70B — 30 RPM free" },
    { key: "deepseek_api_key", label: "DeepSeek API Key", hint: "DeepSeek V3 — ~$0.27/M tokens" },
    { key: "openai_api_key", label: "OpenAI API Key", hint: "GPT-4o-mini — small free credits" },
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

      {message && <p style={message.includes("saved") || message.includes("updated") ? styles.success : styles.error}>{message}</p>}

      {tab === "apikeys" && (
        <div>
          <h2 style={styles.h2}>🧠 AI Text</h2>
          <p style={styles.hint}>At least one provider required.</p>
          {aiProviders.map((p) => (
            <div key={p.key} style={styles.keyRow}>
              <label style={styles.keyLabel}>
                {p.label}
                <span style={styles.keyHint}>{p.hint}</span>
              </label>
              <input
                type="password"
                placeholder={keys[p.key] ? "•••• configured" : "Enter key"}
                value={keyValues[p.key] ?? ""}
                onChange={(e) => setKeyValues({ ...keyValues, [p.key]: e.target.value })}
                style={styles.input}
              />
            </div>
          ))}
          <h2 style={{ ...styles.h2, marginTop: 28 }}>📊 YouTube</h2>
          <p style={styles.hint}>Connect your channel — real analytics data makes scripts better.</p>
          <button disabled style={{ ...styles.primaryBtn, opacity: 0.5 }}>Connect YouTube (coming soon)</button>

          <button onClick={handleSaveKeys} disabled={saving} style={styles.primaryBtn}>
            {saving ? "Saving..." : "Save API Keys"}
          </button>
        </div>
      )}

      {tab === "channel" && (
        <div>
          <h2 style={styles.h2}>Channel Settings</h2>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Name</label>
            <input value={chName} onChange={(e) => setChName(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Niche</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Audience</label>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Language</label>
            <input value={language} onChange={(e) => setLanguage(e.target.value)} style={styles.input} />
          </div>
          <button onClick={handleSaveChannel} disabled={savingChannel} style={styles.primaryBtn}>
            {savingChannel ? "Saving..." : "Save Channel"}
          </button>
        </div>
      )}

      {tab === "account" && (
        <div>
          <h2 style={styles.h2}>Account</h2>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Email</label>
            <input value={user?.email || ""} disabled style={{ ...styles.input, opacity: 0.5 }} />
          </div>
          <div style={styles.keyRow}>
            <label style={styles.keyLabel}>Plan</label>
            <input value={(user?.subscription_tier || "free").toUpperCase()} disabled style={{ ...styles.input, opacity: 0.5 }} />
          </div>
          <p style={styles.hint}>
            {user?.subscription_tier === "free"
              ? "Upgrade to Pro for unlimited packages."
              : `You're on the ${user?.subscription_tier} plan.`}
          </p>
        </div>
      )}

      {tab === "billing" && (
        <div>
          <h2 style={styles.h2}>Billing</h2>
          <p style={styles.hint}>Payment method and invoice history will appear here when checkout is configured.</p>
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
  success: { color: "#4ade80", fontSize: 14, marginBottom: 12 },
  error: { color: "#f87171", fontSize: 14, marginBottom: 12 },
};

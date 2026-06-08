import { useState, useEffect, type FormEvent } from "react";
import { api } from "../../lib/api";

export default function APIKeyForm() {
  const [keys, setKeys] = useState({ gemini_api_key: "", grok_api_key: "", cerebras_api_key: "" });
  const [status, setStatus] = useState({ gemini: false, grok: false, cerebras: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.getApiKeys().then((data: any) => setStatus(data));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await api.updateApiKeys(keys);
      setMsg("API keys saved.");
      const updated = await api.getApiKeys();
      setStatus(updated);
      setKeys({ gemini_api_key: "", grok_api_key: "", cerebras_api_key: "" });
    } catch (err: any) {
      setMsg("Error: " + err.message);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={{ margin: 0, fontSize: 18 }}>API Keys</h2>
      <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
        Keys are stored locally in your SQLite database. Only free-tier keys needed.
      </p>

      {(["gemini", "grok", "cerebras"] as const).map((p) => (
        <label key={p} style={styles.label}>
          <span style={styles.providerName}>
            {p.charAt(0).toUpperCase() + p.slice(1)} API Key
            <span style={{ ...styles.dot, background: status[p] ? "#4caf50" : "#666" }} />
          </span>
          <input
            style={styles.input}
            type="password"
            placeholder={status[p] ? "•••• configured" : "Enter key"}
            value={(keys as any)[`${p}_api_key`]}
            onChange={(e) => setKeys({ ...keys, [`${p}_api_key`]: e.target.value })}
          />
        </label>
      ))}

      <button type="submit" disabled={saving} style={styles.btn}>
        {saving ? "Saving..." : "Save Keys"}
      </button>
      {msg && <p style={{ color: msg.startsWith("Error") ? "#e94560" : "#4caf50", fontSize: 13 }}>{msg}</p>}
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 },
  label: { display: "flex", flexDirection: "column", gap: 6 },
  providerName: {
    fontSize: 13,
    color: "#aaa",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  input: {
    padding: "10px 12px",
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    fontSize: 14,
  },
  btn: {
    padding: "12px 24px",
    background: "#e94560",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
};

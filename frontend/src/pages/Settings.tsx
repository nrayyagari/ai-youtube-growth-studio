import { useState, useEffect } from "react";
import APIKeyForm from "../components/forms/APIKeyForm";

export default function Settings() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [ytConnected, setYtConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/youtube/oauth/status")
      .then((r) => r.json())
      .then((d) => setYtConnected(d.connected))
      .catch(() => {});
  }, []);

  const handleConnect = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setMsg("Enter Client ID and Client Secret");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const redirectUri = "http://localhost:8000/api/youtube/oauth/callback";
      const res = await fetch("/api/youtube/oauth/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });
      const data = await res.json();
      if (data.auth_url) {
        window.open(data.auth_url, "_blank");
        setMsg("Complete OAuth in the opened window. Then click Refresh Status.");
      }
    } catch (err: any) {
      setMsg("Error: " + err.message);
    }
    setLoading(false);
  };

  const checkStatus = async () => {
    const res = await fetch("/api/youtube/oauth/status");
    const data = await res.json();
    setYtConnected(data.connected);
    if (data.connected) setMsg("YouTube connected!");
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, color: "#fff", marginBottom: 24 }}>Settings</h1>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>AI API Keys</h2>
        <APIKeyForm />
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>YouTube Analytics OAuth</h2>
        <p style={styles.help}>
          Create a Google Cloud Project, enable YouTube Analytics API + YouTube Data API v3,
          create an OAuth 2.0 Web Application credential. Add this exact redirect URI:
          <code style={styles.code}>
            http://localhost:8000/api/youtube/oauth/callback
          </code>
        </p>
        <div style={styles.status}>
          Status:{" "}
          <span style={{ color: ytConnected ? "#4ade80" : "#f87171", fontWeight: 600 }}>
            {ytConnected ? "Connected" : "Not Connected"}
          </span>
        </div>

        <div style={styles.form}>
          <label style={styles.label}>
            Client ID
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxx.apps.googleusercontent.com"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Client Secret
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-..."
              style={styles.input}
            />
          </label>
          <div style={styles.buttons}>
            <button onClick={handleConnect} disabled={loading} style={styles.btn}>
              {loading ? "Opening..." : "Connect YouTube"}
            </button>
            <button onClick={checkStatus} style={styles.btnOutline}>
              Refresh Status
            </button>
          </div>
          {msg && (
            <p style={{ color: msg.includes("Error") ? "#f87171" : "#4ade80", fontSize: 13, marginTop: 8 }}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    background: "#1e1e2e",
    borderRadius: 8,
    padding: "20px 24px",
    border: "1px solid #333",
    marginBottom: 20,
    maxWidth: 700,
  },
  sectionTitle: { fontSize: 18, margin: "0 0 12px", color: "#ccc" },
  help: { fontSize: 12, color: "#888", lineHeight: 1.6, marginBottom: 12 },
  code: {
    display: "block",
    background: "#0f0f1a",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 11,
    color: "#e94560",
    marginTop: 4,
  },
  status: { fontSize: 14, marginBottom: 16, color: "#aaa" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#888" },
  input: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid #444",
    background: "#0f0f1a",
    color: "#eee",
    fontSize: 14,
  },
  buttons: { display: "flex", gap: 10, marginTop: 8 },
  btn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    background: "#e94560",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnOutline: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "1px solid #e94560",
    background: "transparent",
    color: "#e94560",
    cursor: "pointer",
    fontSize: 14,
  },
};

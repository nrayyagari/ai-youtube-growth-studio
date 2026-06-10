import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { storage } from "../lib/storage";

export default function Generator() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Enter a topic first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const { api_keys, channel } = await loadLocalConfig();
      const result = await api.generate({ topic, reference_url: referenceUrl || undefined, api_keys, channel });
      await storage.savePackage(result);
      navigate(`/packages/${result.id}`);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Generate Script</h1>

      <label style={styles.label}>Topic or Idea</label>
      <textarea
        placeholder="How AI is changing remote work..."
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={3}
        style={{ ...styles.input, resize: "vertical", marginBottom: 20, minHeight: 80 }}
      />

      <label style={styles.label}>Reference URL (optional)</label>
      <input
        placeholder="https://youtube.com/watch?v=..."
        value={referenceUrl}
        onChange={(e) => setReferenceUrl(e.target.value)}
        style={styles.input}
      />
      <p style={styles.hint}>Analyze a video's style to match its pacing, tone, and structure.</p>

      <button onClick={handleGenerate} disabled={generating || !topic.trim()} style={generating ? styles.generateBtnDisabled : styles.generateBtn}>
        {generating ? "Generating..." : "Generate Script →"}
      </button>

      {generating && <p style={styles.progress}>Writing script... Planning scenes... Generating titles... Running quality checks...</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

async function loadLocalConfig(): Promise<{ api_keys: Record<string, string>; channel: Record<string, string> }> {
  const gemini = await storage.getSetting("gemini_api_key") || "";
  const groq = await storage.getSetting("groq_api_key") || "";
  const channelName = await storage.getSetting("channel_name") || "My Channel";
  return {
    api_keys: { gemini_api_key: gemini, groq_api_key: groq },
    channel: { name: channelName, language: "en" },
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 600, margin: "0 auto", padding: "40px 32px" },
  h1: { fontSize: 28, color: "#fff", marginBottom: 32 },
  label: { display: "block", color: "#bbb", fontSize: 14, fontWeight: 600, marginBottom: 8 },
  hint: { color: "#666", fontSize: 12, marginTop: -12, marginBottom: 20 },
  input: { display: "block", width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, marginBottom: 12, boxSizing: "border-box" },
  generateBtn: { display: "block", width: "100%", padding: "14px", borderRadius: 8, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 16, marginBottom: 12 },
  generateBtnDisabled: { display: "block", width: "100%", padding: "14px", borderRadius: 8, border: "none", background: "#7a2d3a", color: "#aaa", cursor: "not-allowed", fontWeight: 800, fontSize: 16, marginBottom: 12 },
  progress: { color: "#8fd3ff", fontSize: 14, textAlign: "center", marginBottom: 12 },
  error: { color: "#f87171", fontSize: 14, marginBottom: 12 },
};

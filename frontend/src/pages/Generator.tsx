import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { storage } from "../lib/storage";

export default function Generator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [hasProviderKey, setHasProviderKey] = useState(false);
  const [hasChannelContext, setHasChannelContext] = useState(false);

  useEffect(() => {
    const suggestedTopic = searchParams.get("topic");
    if (suggestedTopic) {
      setTopic(suggestedTopic);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadPreflight = async () => {
      const [keys, channel] = await Promise.all([
        storage.getProviderKeys(),
        storage.getChannelProfile(),
      ]);
      setHasProviderKey(Object.values(keys).some(Boolean));
      setHasChannelContext(Boolean(channel.niche?.trim() || channel.audience?.trim()));
    };
    void loadPreflight();
  }, []);

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
      const packageId = await storage.savePackage(result);
      navigate(`/packages/${packageId}`);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Generate Script</h1>

      {!hasProviderKey && (
        <div style={styles.notice}>
          <strong style={styles.noticeTitle}>Add an AI provider key first.</strong>
          <p style={styles.noticeText}>Generation uses browser-stored user keys. Add one in <Link to="/settings" style={styles.noticeLink}>Settings</Link> before running a package.</p>
        </div>
      )}

      {!hasChannelContext && (
        <div style={styles.noticeMuted}>
          <strong style={styles.noticeTitle}>Channel profile is still thin.</strong>
          <p style={styles.noticeText}>You can still generate now, but the results get better when the user saves niche and audience details in <Link to="/settings" style={styles.noticeLink}>Settings</Link>.</p>
        </div>
      )}

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

      <button onClick={handleGenerate} disabled={generating || !topic.trim() || !hasProviderKey} style={generating || !hasProviderKey ? styles.generateBtnDisabled : styles.generateBtn}>
        {generating ? "Generating..." : "Generate Script →"}
      </button>

      {generating && <p style={styles.progress}>Writing script... Planning scenes... Generating titles... Running quality checks...</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

async function loadLocalConfig(): Promise<{ api_keys: Record<string, string>; channel: Record<string, string> }> {
  const providerKeys = await storage.getProviderKeys();
  const channel = await storage.getChannelProfile();
  return {
    api_keys: providerKeys as Record<string, string>,
    channel: channel as unknown as Record<string, string>,
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 600, margin: "0 auto", padding: "40px 32px" },
  h1: { fontSize: 28, color: "#fff", marginBottom: 32 },
  notice: { marginBottom: 18, padding: 14, borderRadius: 10, border: "1px solid #7f1d1d", background: "rgba(127,29,29,0.22)" },
  noticeMuted: { marginBottom: 18, padding: 14, borderRadius: 10, border: "1px solid #2f3344", background: "#121826" },
  noticeTitle: { color: "#fff", fontSize: 14 },
  noticeText: { margin: "6px 0 0", color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 },
  noticeLink: { color: "#8fd3ff" },
  label: { display: "block", color: "#bbb", fontSize: 14, fontWeight: 600, marginBottom: 8 },
  hint: { color: "#666", fontSize: 12, marginTop: -12, marginBottom: 20 },
  input: { display: "block", width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, marginBottom: 12, boxSizing: "border-box" },
  generateBtn: { display: "block", width: "100%", padding: "14px", borderRadius: 8, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 16, marginBottom: 12 },
  generateBtnDisabled: { display: "block", width: "100%", padding: "14px", borderRadius: 8, border: "none", background: "#7a2d3a", color: "#aaa", cursor: "not-allowed", fontWeight: 800, fontSize: 16, marginBottom: 12 },
  progress: { color: "#8fd3ff", fontSize: 14, textAlign: "center", marginBottom: 12 },
  error: { color: "#f87171", fontSize: 14, marginBottom: 12 },
};

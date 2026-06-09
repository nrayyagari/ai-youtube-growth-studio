import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChannels } from "../hooks/useApi";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { LoadingState } from "../components/ui/ErrorBoundary";

export default function Generator() {
  const navigate = useNavigate();
  const { channels, loading, reload } = useChannels();
  const { user } = useAuth();

  const [selectedChannel, setSelectedChannel] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("en");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);

  const usageLimit = user?.usage?.packages_this_month?.limit ?? null;
  const usageUsed = user?.usage?.packages_this_month?.used ?? 0;
  const remaining = usageLimit !== null ? usageLimit - usageUsed : null;

  useEffect(() => {
    if (!loading && channels.length > 0 && !selectedChannel) {
      setSelectedChannel(String(channels[0].id));
    }
  }, [channels, loading, selectedChannel]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setCreatingChannel(true);
    setError("");
    try {
      const result = await api.createChannel({ name: newChannelName.trim(), language });
      await reload();
      setSelectedChannel(String(result.id));
      setShowNewChannel(false);
      setNewChannelName("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedChannel) {
      setError("Create or select a channel first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const workflows = await api.listWorkflows();
      const workflowId = workflows[0]?.id;
      if (!workflowId) {
        setError("No video styles configured. Contact support.");
        setGenerating(false);
        return;
      }
      const result = await api.generate(Number(selectedChannel), workflowId, topic);
      navigate(`/packages/${result.package_id || result.id}`);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
    }
  };

  if (loading) return <LoadingState text="Loading..." />;

  const channelName = channels.find((c) => String(c.id) === selectedChannel)?.name || "";

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Generate Script</h1>

      <label style={styles.label}>Channel</label>
      {showNewChannel ? (
        <div style={styles.inlineForm}>
          <input
            placeholder="Channel name"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            style={styles.input}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleCreateChannel} disabled={creatingChannel || !newChannelName.trim()} style={styles.primaryBtn}>
              {creatingChannel ? "Creating..." : "Create"}
            </button>
            <button onClick={() => setShowNewChannel(false)} style={styles.secondaryBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} style={styles.select}>
            {channels.length === 0 && <option value="">No channels yet</option>}
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={() => setShowNewChannel(true)} style={styles.newBtn}>+ New</button>
        </div>
      )}

      <label style={styles.label}>Language</label>
      <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ ...styles.select, marginBottom: 24, width: "100%" }}>
        <option value="en">English</option>
        <option value="hi">Hindi</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="de">German</option>
      </select>

      <label style={styles.label}>Topic</label>
      <textarea
        placeholder="How AI is changing remote work... (or leave blank — we'll suggest ideas)"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={3}
        style={{ ...styles.input, resize: "vertical", marginBottom: 24, minHeight: 80 }}
      />

      <button onClick={handleGenerate} disabled={generating || !selectedChannel} style={generating ? styles.generateBtnDisabled : styles.generateBtn}>
        {generating ? "Generating..." : "Generate Script →"}
      </button>

      {generating && <p style={styles.progress}>Writing script... Planning scenes... Generating titles... Running quality checks...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {remaining !== null && (
        <p style={styles.usage}>
          {channelName ? `Channel: ${channelName} · ` : ""}
          Free tier: {remaining} package{remaining !== 1 ? "s" : ""} remaining this month
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 600, margin: "0 auto", padding: "40px 32px" },
  h1: { fontSize: 28, color: "#fff", marginBottom: 32 },
  label: { display: "block", color: "#bbb", fontSize: 14, fontWeight: 600, marginBottom: 8 },
  input: { display: "block", width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, marginBottom: 12, boxSizing: "border-box" },
  select: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, flex: 1 },
  newBtn: { padding: "10px 16px", borderRadius: 6, border: "1px solid #555", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 14 },
  inlineForm: { marginBottom: 24, padding: 16, border: "1px solid #333", borderRadius: 8, background: "#181827" },
  primaryBtn: { padding: "10px 20px", borderRadius: 6, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  secondaryBtn: { padding: "10px 20px", borderRadius: 6, border: "1px solid #555", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 14 },
  generateBtn: { display: "block", width: "100%", padding: "14px", borderRadius: 8, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 16, marginBottom: 12 },
  generateBtnDisabled: { display: "block", width: "100%", padding: "14px", borderRadius: 8, border: "none", background: "#7a2d3a", color: "#aaa", cursor: "not-allowed", fontWeight: 800, fontSize: 16, marginBottom: 12 },
  progress: { color: "#8fd3ff", fontSize: 14, textAlign: "center", marginBottom: 12 },
  error: { color: "#f87171", fontSize: 14, marginBottom: 12 },
  usage: { color: "#666", fontSize: 13, textAlign: "center", marginTop: 16 },
};

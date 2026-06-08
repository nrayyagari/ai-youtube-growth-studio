import { useState } from "react";
import { useChannels, useWorkflows } from "../hooks/useApi";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import GrowthScoreBreakdown from "../components/reports/GrowthScoreBreakdown";

export default function Generator() {
  const { channels } = useChannels();
  const { workflows } = useWorkflows();
  const navigate = useNavigate();

  const [channelId, setChannelId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!channelId || !workflowId) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const data = await api.generate(Number(channelId), Number(workflowId), topic);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    }
    setGenerating(false);
  }

  return (
    <div>
      <h1 style={styles.h1}>Generate Video Package</h1>
      <div style={styles.panel}>
        <select style={styles.select} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          <option value="">Select Channel...</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select style={styles.select} value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
          <option value="">Select Workflow...</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <input
          style={styles.input}
          placeholder="Optional: Topic or idea to start from"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <button
          onClick={handleGenerate}
          disabled={!channelId || !workflowId || generating}
          style={{
            ...styles.btn,
            opacity: !channelId || !workflowId ? 0.5 : 1,
          }}
        >
          {generating ? "Generating... (may take 30-60s)" : "Generate Package"}
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, color: "#ccc", margin: 0 }}>
              Package #{result.id}
            </h2>
            <button
              onClick={() => navigate(`/packages/${result.id}`)}
              style={{ padding: "8px 16px", background: "#16213e", border: "1px solid #333", borderRadius: 6, color: "#e0e0e0", cursor: "pointer", fontSize: 13 }}
            >
              View Full Package
            </button>
          </div>
          {result.approval && <GrowthScoreBreakdown approval={result.approval} />}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, color: "#fff", marginBottom: 24 },
  panel: {
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 8,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    maxWidth: 560,
  },
  select: {
    padding: "10px 12px",
    background: "#16213e",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    fontSize: 14,
  },
  input: {
    padding: "10px 12px",
    background: "#16213e",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    fontSize: 14,
  },
  btn: {
    padding: "14px 24px",
    background: "#e94560",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  error: {
    marginTop: 16,
    padding: 16,
    background: "rgba(233, 69, 96, 0.15)",
    border: "1px solid rgba(233, 69, 96, 0.3)",
    borderRadius: 8,
    color: "#ef9a9a",
    maxWidth: 560,
  },
};

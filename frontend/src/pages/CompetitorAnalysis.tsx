import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Channel } from "../lib/types";

interface CompetitorAnalysis {
  id: number;
  channel_id: number;
  competitor_url: string;
  analysis_type: string;
  findings: string;
  created_at: string;
}

export default function CompetitorAnalysis() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [analyses, setAnalyses] = useState<CompetitorAnalysis[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [analysisType, setAnalysisType] = useState("general");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    api.listChannels().then(setChannels).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedChannel) loadAnalyses(selectedChannel);
  }, [selectedChannel]);

  const loadAnalyses = async (chId: number) => {
    setError("");
    try {
      const r = await fetch(`/api/channels/${chId}/competitor-analysis`);
      const data = await r.json();
      setAnalyses(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRun = async () => {
    if (!selectedChannel || !url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/channels/${selectedChannel}/competitor-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitor_url: url, analysis_type: analysisType }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Failed");
      loadAnalyses(selectedChannel);
      setUrl("");
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const parseFindings = (findings: string) => {
    try { return typeof findings === "string" ? JSON.parse(findings) : findings; }
    catch { return { raw: findings }; }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, color: "#e0e0e0", marginBottom: 20 }}>Competitor Analysis</h2>

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <select style={styles.select} value={selectedChannel || ""} onChange={(e) => setSelectedChannel(Number(e.target.value) || null)}>
          <option value="">Select Channel...</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {selectedChannel && (
        <div style={styles.card}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 12 }}>Run New Analysis</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              placeholder="YouTube channel or video URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ ...styles.select, flex: 1, minWidth: 300 }}
            />
            <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value)} style={{ ...styles.select, minWidth: 140 }}>
              <option value="general">General</option>
              <option value="content_strategy">Content Strategy</option>
              <option value="thumbnail_analysis">Thumbnail Analysis</option>
              <option value="engagement_tactics">Engagement Tactics</option>
              <option value="niche_positioning">Niche Positioning</option>
            </select>
            <button onClick={handleRun} disabled={loading || !url.trim()} style={{ ...styles.btn, opacity: loading ? 0.5 : 1 }}>
              {loading ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
        </div>
      )}

      {selectedChannel && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 12 }}>
            Past Analyses ({analyses.length})
          </h3>
          {analyses.map((a) => {
            const findings = parseFindings(a.findings);
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id} style={{ ...styles.card, marginBottom: 12, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ color: "#e94560", fontSize: 12, marginRight: 8 }}>{a.analysis_type}</span>
                    <span style={{ color: "#ccc", fontSize: 14 }}>{a.competitor_url}</span>
                  </div>
                  <span style={{ color: "#666", fontSize: 11 }}>{a.created_at?.split("T")[0]}</span>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 12, padding: "12px 0 0", borderTop: "1px solid #333" }}>
                    {findings.content_strategy && <FindingsRow label="Content Strategy" value={findings.content_strategy} />}
                    {findings.format_patterns && <FindingsRow label="Format Patterns" value={findings.format_patterns} />}
                    {findings.thumbnail_strategy && <FindingsRow label="Thumbnail Strategy" value={findings.thumbnail_strategy} />}
                    {findings.engagement_tactics && <FindingsRow label="Engagement Tactics" value={findings.engagement_tactics} />}
                    {findings.overall_assessment && <FindingsRow label="Overall Assessment" value={findings.overall_assessment} />}
                    {findings.weaknesses && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ color: "#888", fontSize: 11, textTransform: "uppercase" }}>Weaknesses</span>
                        <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                          {(Array.isArray(findings.weaknesses) ? findings.weaknesses : []).map((w: string, i: number) => (
                            <li key={i} style={{ color: "#f87171", fontSize: 12 }}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {findings.strengths_to_adapt && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ color: "#888", fontSize: 11, textTransform: "uppercase" }}>Strengths to Adapt</span>
                        <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                          {(Array.isArray(findings.strengths_to_adapt) ? findings.strengths_to_adapt : []).map((s: string, i: number) => (
                            <li key={i} style={{ color: "#4ade80", fontSize: 12 }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {findings.raw && <pre style={{ color: "#888", fontSize: 11, whiteSpace: "pre-wrap" }}>{findings.raw}</pre>}
                  </div>
                )}
              </div>
            );
          })}
          {analyses.length === 0 && <p style={{ color: "#666", textAlign: "center", padding: 24 }}>No analyses yet. Add a competitor URL above.</p>}
        </div>
      )}
    </div>
  );
}

function FindingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: "#888", fontSize: 11, textTransform: "uppercase" }}>{label}</span>
      <p style={{ color: "#bbb", fontSize: 12, margin: "2px 0" }}>{value}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  select: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid #444",
    background: "#1e1e2e",
    color: "#eee",
    fontSize: 14,
  },
  card: {
    background: "#1e1e2e",
    borderRadius: 8,
    padding: "16px 22px",
    border: "1px solid #333",
  },
  btn: {
    padding: "10px 20px",
    background: "#e94560",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  error: {
    marginBottom: 12,
    padding: 12,
    background: "rgba(233, 69, 96, 0.15)",
    border: "1px solid rgba(233, 69, 96, 0.3)",
    borderRadius: 6,
    color: "#ef9a9a",
    fontSize: 13,
  },
};

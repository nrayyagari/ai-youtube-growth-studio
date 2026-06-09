import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Channel } from "../lib/types";

interface Pattern {
  id: number;
  channel_id: number;
  pattern_type: string;
  pattern_name: string;
  description: string;
  examples: string;
  effectiveness_score: number;
  created_at: string;
}

export default function PatternLibrary() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPattern, setNewPattern] = useState({ pattern_type: "hook", pattern_name: "", description: "", examples: "", effectiveness_score: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  useEffect(() => {
    api.listChannels().then(setChannels).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedChannel) loadPatterns(selectedChannel);
  }, [selectedChannel]);

  const loadPatterns = async (chId: number) => {
    setError("");
    try {
      const r = await fetch(`/api/channels/${chId}/patterns`);
      const data = await r.json();
      setPatterns(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAdd = async () => {
    if (!selectedChannel || !newPattern.pattern_name.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/channels/${selectedChannel}/patterns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPattern),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Failed");
      loadPatterns(selectedChannel);
      setShowAddForm(false);
      setNewPattern({ pattern_type: "hook", pattern_name: "", description: "", examples: "", effectiveness_score: 0 });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this pattern?")) return;
    try {
      await fetch(`/api/patterns/${id}`, { method: "DELETE" });
      loadPatterns(selectedChannel!);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAIAnalyze = async () => {
    if (!selectedChannel) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const r = await fetch(`/api/channels/${selectedChannel}/pattern-analysis`, { method: "POST" });
      const data = await r.json();
      setAnalysisResult(data);
      loadPatterns(selectedChannel);
    } catch (e: any) {
      setError(e.message);
    }
    setAnalyzing(false);
  };

  const grouped = patterns.reduce((acc, p) => {
    const type = p.pattern_type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {} as Record<string, Pattern[]>);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, color: "#e0e0e0", margin: 0 }}>Pattern Library</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleAIAnalyze} disabled={analyzing || !selectedChannel} style={{ ...styles.aiBtn, opacity: analyzing ? 0.5 : 1 }}>
            {analyzing ? "Analyzing..." : "AI Pattern Analysis"}
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} style={styles.addBtn}>
            {showAddForm ? "Cancel" : "+ Add Pattern"}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <select style={styles.select} value={selectedChannel || ""} onChange={(e) => setSelectedChannel(Number(e.target.value) || null)}>
          <option value="">Select Channel...</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {analysisResult && (
        <div style={{ ...styles.card, marginBottom: 16, borderColor: "#e94560" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ color: "#e94560", fontSize: 15, margin: 0 }}>AI Analysis Complete</h3>
            <button onClick={() => setAnalysisResult(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
          <p style={{ color: "#4ade80", fontSize: 13, marginBottom: 8 }}>{analysisResult.patterns_saved} new patterns saved</p>
          {analysisResult.style_insights && <p style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>{analysisResult.style_insights}</p>}
          {analysisResult.gaps_identified && (
            <div>
              <span style={{ color: "#fbbf24", fontSize: 11, textTransform: "uppercase" }}>Gaps Found</span>
              <p style={{ color: "#fbbf24", fontSize: 12, margin: "2px 0 0" }}>{analysisResult.gaps_identified}</p>
            </div>
          )}
        </div>
      )}

      {showAddForm && selectedChannel && (
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, color: "#ccc", marginBottom: 12 }}>New Pattern</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="Pattern name" value={newPattern.pattern_name} onChange={(e) => setNewPattern({ ...newPattern, pattern_name: e.target.value })} style={styles.input} />
            <select value={newPattern.pattern_type} onChange={(e) => setNewPattern({ ...newPattern, pattern_type: e.target.value })} style={styles.select}>
              <option value="hook">Hook</option>
              <option value="structure">Structure</option>
              <option value="visual">Visual</option>
              <option value="audio">Audio</option>
              <option value="engagement">Engagement</option>
              <option value="cta">Call to Action</option>
            </select>
            <textarea placeholder="Description" value={newPattern.description} onChange={(e) => setNewPattern({ ...newPattern, description: e.target.value })} rows={2} style={{ ...styles.input, resize: "vertical" } as any} />
            <input placeholder="Effectiveness score (0-100)" type="number" min={0} max={100} value={newPattern.effectiveness_score} onChange={(e) => setNewPattern({ ...newPattern, effectiveness_score: Number(e.target.value) })} style={styles.input} />
            <button onClick={handleAdd} disabled={loading} style={styles.btn}>
              {loading ? "Saving..." : "Save Pattern"}
            </button>
          </div>
        </div>
      )}

      {!selectedChannel && <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Select a channel to view its pattern library.</p>}

      {selectedChannel && Object.keys(grouped).length === 0 && <p style={{ color: "#666", textAlign: "center", padding: 40 }}>No patterns yet. Run AI analysis or add manually.</p>}

      {Object.entries(grouped).map(([type, pats]) => (
        <div key={type} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, color: "#e94560", textTransform: "uppercase", marginBottom: 8 }}>{type}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pats.map((p) => (
              <div key={p.id} style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <strong style={{ color: "#eee", fontSize: 14 }}>{p.pattern_name}</strong>
                    <span style={{ ...styles.scoreBadge, background: p.effectiveness_score >= 80 ? "rgba(74,222,128,0.2)" : p.effectiveness_score >= 60 ? "rgba(251,191,36,0.2)" : "rgba(248,113,113,0.2)", color: p.effectiveness_score >= 80 ? "#4ade80" : p.effectiveness_score >= 60 ? "#fbbf24" : "#f87171" }}>
                      {p.effectiveness_score}
                    </span>
                  </div>
                  {p.description && <p style={{ color: "#888", fontSize: 12, margin: "2px 0" }}>{p.description}</p>}
                </div>
                <button onClick={() => handleDelete(p.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 15, padding: 4 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      ))}
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
    minWidth: 250,
  },
  input: {
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
    padding: "14px 18px",
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
  addBtn: {
    padding: "8px 16px",
    background: "transparent",
    border: "1px solid #e94560",
    borderRadius: 6,
    color: "#e94560",
    cursor: "pointer",
    fontSize: 13,
  },
  aiBtn: {
    padding: "8px 16px",
    background: "#16213e",
    border: "1px solid #a371f7",
    borderRadius: 6,
    color: "#a371f7",
    cursor: "pointer",
    fontSize: 13,
  },
  scoreBadge: {
    padding: "2px 7px",
    borderRadius: 3,
    fontSize: 11,
    fontWeight: 700,
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

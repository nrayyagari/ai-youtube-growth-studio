import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { VideoPackage } from "../lib/types";

export default function ABTestPage() {
  const [packages, setPackages] = useState<VideoPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"generate" | "score">("generate");
  const [scoreData, setScoreData] = useState({ performance_data: "{}" });

  useEffect(() => {
    api.listPackages().then((data) => {
      if (Array.isArray(data)) setPackages(data.filter((p: any) => p.status === "APPROVED"));
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/ab-test/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: selectedPackage, topic, script }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Failed");
      setResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleScore = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/ab-test/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: scoreData.performance_data,
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Failed");
      setResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, color: "#e0e0e0", margin: 0 }}>A/B Test Lab</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setActiveTab("generate")} style={{ ...styles.tabBtn, ...(activeTab === "generate" ? styles.tabActive : {}) }}>Generate Variants</button>
          <button onClick={() => setActiveTab("score")} style={{ ...styles.tabBtn, ...(activeTab === "score" ? styles.tabActive : {}) }}>Score Results</button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {activeTab === "generate" && (
        <div style={styles.card}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 16 }}>Generate Title & Thumbnail Variants</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
            <select style={styles.select} value={selectedPackage || ""} onChange={(e) => setSelectedPackage(Number(e.target.value) || null)}>
              <option value="">Select an approved package (or use topic below)...</option>
              {packages.map((p) => <option key={p.id} value={p.id}>Package #{p.id} ({p.status})</option>)}
            </select>
            <input placeholder="Or enter a topic directly" value={topic} onChange={(e) => setTopic(e.target.value)} style={styles.input} />
            <textarea placeholder="Or paste a script excerpt" value={script} onChange={(e) => setScript(e.target.value)} rows={3} style={{ ...styles.input, resize: "vertical" } as any} />
            <button onClick={handleGenerate} disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.5 : 1 }}>
              {loading ? "Generating..." : "Generate A/B Test Variants"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "score" && (
        <div style={styles.card}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 16 }}>Score A/B Test Results</h3>
          <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
            Paste JSON with tested titles, thumbnails, and performance data (impressions, clicks per variant).
          </p>
          <textarea
            value={scoreData.performance_data}
            onChange={(e) => setScoreData({ performance_data: e.target.value })}
            rows={10}
            placeholder={`{\n  "titles": [{"variant":"A","title":"Title A","impressions":1000,"clicks":85}],\n  "thumbnails": [{"variant":"A","concept":"Thumb A","impressions":1000,"clicks":72}],\n  "performance_data": {"total_impressions":2000,"total_clicks":157}\n}`}
            style={{ ...styles.input, resize: "vertical", fontFamily: "monospace", fontSize: 12, minHeight: 160 } as any}
          />
          <button onClick={handleScore} disabled={loading} style={{ ...styles.btn, marginTop: 12, opacity: loading ? 0.5 : 1 }}>
            {loading ? "Scoring..." : "Score Results"}
          </button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 24 }}>
          {result.titles && (
            <div style={styles.card}>
              <h3 style={{ fontSize: 14, color: "#e94560", marginBottom: 12 }}>Title Variants</h3>
              {result.titles.map((t: any, i: number) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #2a2a3a", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={styles.variantBadge}>{t.variant}</span>
                      <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                    </div>
                    <span style={{ color: "#888", fontSize: 11, textTransform: "uppercase" }}>{t.angle}</span>
                    {t.ctr_rationale && <p style={{ color: "#666", fontSize: 11, margin: "4px 0 0" }}>{t.ctr_rationale}</p>}
                  </div>
                  <div style={styles.ctrBadge}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.predicted_ctr >= 85 ? "#4ade80" : t.predicted_ctr >= 75 ? "#fbbf24" : "#f87171" }}>{t.predicted_ctr}</div>
                    <div style={{ fontSize: 9, color: "#666" }}>CTR</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.thumbnails && (
            <div style={{ ...styles.card, marginTop: 16 }}>
              <h3 style={{ fontSize: 14, color: "#a371f7", marginBottom: 12 }}>Thumbnail Concepts</h3>
              {result.thumbnails.map((t: any, i: number) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #2a2a3a", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={styles.variantBadge}>{t.variant}</span>
                      <span style={{ color: "#a371f7", fontSize: 12 }}>{t.text_overlay || "No text overlay"}</span>
                    </div>
                    <p style={{ color: "#ccc", fontSize: 13, margin: "4px 0" }}>{t.concept}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      {(t.color_palette || []).map((c: string, ci: number) => (
                        <span key={ci} style={{ display: "inline-block", width: 16, height: 16, borderRadius: 3, background: c, border: "1px solid #444" }} title={c} />
                      ))}
                      <span style={{ color: "#888", fontSize: 10, marginLeft: 4 }}>{t.emotional_trigger}</span>
                    </div>
                  </div>
                  <div style={styles.ctrBadge}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.predicted_ctr >= 85 ? "#4ade80" : t.predicted_ctr >= 75 ? "#fbbf24" : "#f87171" }}>{t.predicted_ctr}</div>
                    <div style={{ fontSize: 9, color: "#666" }}>CTR</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.recommended_combination && (
            <div style={{ ...styles.card, marginTop: 16, borderColor: "#4ade80" }}>
              <h3 style={{ fontSize: 14, color: "#4ade80", marginBottom: 8 }}>Recommended Combination</h3>
              <p style={{ color: "#ccc", fontSize: 13 }}>
                Title <strong>{result.recommended_combination.title_variant}</strong> + Thumbnail <strong>{result.recommended_combination.thumbnail_variant}</strong>
                {" "}→ Predicted CTR: <strong style={{ color: "#4ade80" }}>{result.recommended_combination.combined_ctr_prediction}%</strong>
              </p>
              {result.recommended_combination.rationale && <p style={{ color: "#888", fontSize: 12, marginTop: 4 }}>{result.recommended_combination.rationale}</p>}
            </div>
          )}

          {result.results && (
            <div style={{ ...styles.card, marginTop: 16 }}>
              <h3 style={{ fontSize: 14, color: "#4ade80", marginBottom: 12 }}>Test Results</h3>
              {result.results.map((r: any, i: number) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #2a2a3a", fontSize: 13 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={styles.variantBadge}>{r.variant}</span>
                    <span style={{ color: "#888" }}>{r.type}</span>
                    <span style={{ color: r.outcome === "won" ? "#4ade80" : r.outcome === "lost" ? "#f87171" : "#fbbf24", fontWeight: 600 }}>{r.outcome?.toUpperCase()}</span>
                    {r.actual_ctr !== undefined && <span style={{ color: "#ccc" }}>{r.actual_ctr}% CTR</span>}
                    {r.improvement_pct && <span style={{ color: "#4ade80" }}>+{r.improvement_pct}%</span>}
                  </div>
                  {r.learnings && <p style={{ color: "#888", fontSize: 11 }}>{r.learnings}</p>}
                </div>
              ))}
            </div>
          )}

          {result.next_test_recommendation && (
            <div style={{ ...styles.card, marginTop: 16, background: "rgba(163,113,247,0.05)" }}>
              <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>Next Test</span>
              <p style={{ color: "#a371f7", fontSize: 13, margin: "4px 0 0" }}>{result.next_test_recommendation}</p>
            </div>
          )}
        </div>
      )}
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
    padding: "18px 22px",
    border: "1px solid #333",
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
  tabBtn: {
    padding: "8px 18px",
    borderRadius: 6,
    border: "1px solid #333",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: 13,
  },
  tabActive: {
    background: "#16213e",
    color: "#e94560",
    borderColor: "#e94560",
  },
  variantBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    background: "#16213e",
    color: "#e94560",
    fontSize: 11,
    fontWeight: 700,
  },
  ctrBadge: {
    textAlign: "center",
    minWidth: 48,
    padding: "4px 8px",
    borderRadius: 6,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid #333",
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

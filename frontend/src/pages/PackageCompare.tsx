import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { VideoPackage, PackageSection } from "../lib/types";

export default function PackageCompare() {
  const [packages, setPackages] = useState<VideoPackage[]>([]);
  const [leftId, setLeftId] = useState<number | null>(null);
  const [rightId, setRightId] = useState<number | null>(null);
  const [left, setLeft] = useState<any>(null);
  const [right, setRight] = useState<any>(null);
  const [error] = useState("");

  useEffect(() => {
    api.listPackages().then((data) => setPackages(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => { if (leftId) api.getPackage(leftId).then(setLeft).catch(() => {}); else setLeft(null); }, [leftId]);
  useEffect(() => { if (rightId) api.getPackage(rightId).then(setRight).catch(() => {}); else setRight(null); }, [rightId]);

  const parseSection = (section: PackageSection) => {
    try { return { raw: section.content, ...JSON.parse(section.content) }; }
    catch { return { raw: section.content }; }
  };

  const renderSection = (label: string, leftSection: any, rightSection: any) => {
    const ls = leftSection ? parseSection(leftSection) : null;
    const rs = rightSection ? parseSection(rightSection) : null;
    return (
      <div key={label} style={{ marginBottom: 16 }}>
        <h4 style={{ color: "#e94560", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>{label}</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CompCell data={ls} color="#4ade80" score={leftSection?.score} />
          <CompCell data={rs} color="#a371f7" score={rightSection?.score} />
        </div>
      </div>
    );
  };

  const leftSections = left?.sections || [];
  const rightSections = right?.sections || [];
  const allTypes = [...new Set([...leftSections.map((s: any) => s.section_type), ...rightSections.map((s: any) => s.section_type)])];

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h2 style={{ fontSize: 22, color: "#e0e0e0", marginBottom: 20 }}>Package Comparison</h2>

      {error && <div style={styles.error}>{error}</div>}

      <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: "#888", fontSize: 12, display: "block", marginBottom: 4 }}>Package A</label>
          <select style={styles.select} value={leftId || ""} onChange={(e) => setLeftId(Number(e.target.value) || null)}>
            <option value="">Select...</option>
            {packages.map((p) => <option key={p.id} value={p.id}>#{p.id} - {p.status}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ color: "#888", fontSize: 12, display: "block", marginBottom: 4 }}>Package B</label>
          <select style={styles.select} value={rightId || ""} onChange={(e) => setRightId(Number(e.target.value) || null)}>
            <option value="">Select...</option>
            {packages.filter((p) => p.id !== leftId).map((p) => <option key={p.id} value={p.id}>#{p.id} - {p.status}</option>)}
          </select>
        </div>
      </div>

      {left && right && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ ...styles.statCard, borderLeft: "3px solid #4ade80" }}>
              <span style={{ color: "#888", fontSize: 11 }}>Package A</span>
              <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>#{left.id} — {left.status}</span>
            </div>
            <div style={{ ...styles.statCard, borderLeft: "3px solid #a371f7" }}>
              <span style={{ color: "#888", fontSize: 11 }}>Package B</span>
              <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>#{right.id} — {right.status}</span>
            </div>
          </div>

          {allTypes.map((type: string) => {
            const ls = leftSections.find((s: any) => s.section_type === type);
            const rs = rightSections.find((s: any) => s.section_type === type);
            return renderSection(type, ls, rs);
          })}

          <div style={styles.card}>
            <h4 style={{ color: "#e94560", fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>Scores</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <CompScoreList scores={left?.growth_scores} label="Growth" color="#4ade80" />
                <CompScoreList scores={left?.qa_reports} label="QA" color="#fbbf24" />
              </div>
              <div>
                <CompScoreList scores={right?.growth_scores} label="Growth" color="#a371f7" />
                <CompScoreList scores={right?.qa_reports} label="QA" color="#fbbf24" />
              </div>
            </div>
          </div>
        </div>
      )}

      {!left || !right ? <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Select two packages to compare.</p> : null}
    </div>
  );
}

function CompCell({ data, color, score }: { data: any; color: string; score?: number }) {
  if (!data) return <div style={{ background: "#1a1a2e", borderRadius: 6, padding: "12px 14px", border: "1px solid #2a2a3a", color: "#555", fontSize: 12, textAlign: "center" }}>—</div>;
  return (
    <div style={{ background: "#1a1a2e", borderRadius: 6, padding: "12px 14px", border: `1px solid ${color}30` }}>
      {score !== undefined && <div style={{ marginBottom: 6 }}><span style={{ color, fontSize: 16, fontWeight: 800 }}>{score}</span><span style={{ color: "#666", fontSize: 10, marginLeft: 4 }}>/ 100</span></div>}
      <pre style={{ color: "#aaa", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 200, overflow: "auto" }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function CompScoreList({ scores, label, color }: { scores?: any[]; label: string; color: string }) {
  if (!scores?.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>{label}</span>
      {scores.map((s: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
          <span style={{ color: "#aaa" }}>{s.category || s.check_type}</span>
          <span style={{ color, fontWeight: 600 }}>{s.score}</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  select: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, width: "100%", boxSizing: "border-box" },
  card: { background: "#1e1e2e", borderRadius: 8, padding: "16px 20px", border: "1px solid #333", marginBottom: 16 },
  statCard: { background: "#1e1e2e", borderRadius: 6, padding: "12px 16px", border: "1px solid #333", display: "flex", flexDirection: "column", gap: 2 },
  error: { marginBottom: 12, padding: 12, background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.3)", borderRadius: 6, color: "#ef9a9a", fontSize: 13 },
};

import type { ApprovalResult } from "../../lib/types";

interface Props {
  approval: ApprovalResult;
}

export default function GrowthScoreBreakdown({ approval }: Props) {
  const { status, scores, failing, corrections } = approval;
  const approved = status === "APPROVED";

  const categories = [
    { key: "growth_score", label: "Growth Score", weight: "20%" },
    { key: "script_score", label: "Script Quality", weight: "15%" },
    { key: "title_score", label: "Title / CTR", weight: "15%" },
    { key: "thumbnail_score", label: "Thumbnail", weight: "15%" },
    { key: "retention", label: "Retention", weight: "15%" },
    { key: "monetization", label: "Monetization", weight: "15%" },
    { key: "factual_accuracy", label: "Factual Accuracy", weight: "5%" },
    { key: "copyright_safety", label: "Copyright Safety", weight: "—" },
  ];

  return (
    <div style={styles.container}>
      <div style={{ ...styles.badge, background: approved ? "#1b5e20" : "#5c1a1a", color: approved ? "#81c784" : "#ef9a9a" }}>
        {approved ? "APPROVED" : "NEEDS IMPROVEMENT"}
      </div>

      <div style={styles.grid}>
        {categories.map(({ key, label }) => {
          const score = scores[key] || 0;
          const isFail = failing.some((f) => f.category === key);
          return (
            <div key={key} style={styles.item}>
              <div style={styles.label}>{label}</div>
              <div style={styles.barBg}>
                <div
                  style={{
                    ...styles.bar,
                    width: `${Math.min(score, 100)}%`,
                    background: score >= 90 ? "#4caf50" : score >= 70 ? "#ff9800" : "#f44336",
                  }}
                />
              </div>
              <div style={{ ...styles.score, color: isFail ? "#f44336" : "#aaa" }}>{score}/100</div>
            </div>
          );
        })}
      </div>

      {!approved && corrections.length > 0 && (
        <div style={styles.corrections}>
          <strong style={{ fontSize: 13 }}>Improvements needed:</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, color: "#ef9a9a" }}>
            {corrections.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#1a1a2e",
    borderRadius: 8,
    padding: 20,
    border: "1px solid #333",
  },
  badge: {
    display: "inline-block",
    padding: "6px 16px",
    borderRadius: 20,
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 16,
  },
  grid: { display: "flex", flexDirection: "column", gap: 10 },
  item: { display: "flex", alignItems: "center", gap: 12 },
  label: { width: 140, fontSize: 13, color: "#ccc", flexShrink: 0 },
  barBg: {
    flex: 1,
    height: 8,
    background: "#333",
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: { height: "100%", borderRadius: 4, transition: "width 0.3s" },
  score: { width: 50, fontSize: 13, fontWeight: 600, textAlign: "right" },
  corrections: {
    marginTop: 16,
    padding: 12,
    background: "rgba(233, 69, 96, 0.1)",
    borderRadius: 6,
    border: "1px solid rgba(233, 69, 96, 0.3)",
  },
};

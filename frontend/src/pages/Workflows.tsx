import { useWorkflows } from "../hooks/useApi";
import { LoadingState, EmptyState } from "../components/ui/ErrorBoundary";

export default function Workflows() {
  const { workflows, loading } = useWorkflows();

  if (loading) return <LoadingState text="Loading workflows..." />;

  if (workflows.length === 0) return <EmptyState title="No Workflows" description="No workflows configured yet." />;

  return (
    <div>
      <h1 style={styles.h1}>Workflows</h1>
      <div style={styles.grid}>
        {workflows.map((w) => (
          <div key={w.id} style={styles.card}>
            <h3 style={styles.name}>{w.name}</h3>
            <p style={styles.desc}>{w.description}</p>
            <div style={styles.details}>
              <span style={styles.tag}>Script: {w.script_format}</span>
              <span style={styles.tag}>Scenes: {w.scene_format}</span>
              <span style={styles.tag}>Visual: {w.visual_style}</span>
              <span style={styles.tag}>Music: {w.music_style}</span>
            </div>
            {w.skills && w.skills.length > 0 && (
              <div style={styles.skills}>
                <strong style={{ fontSize: 12, color: "#888" }}>Skills:</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {w.skills.map((s) => (
                    <span key={s.id} style={styles.skill}>{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, color: "#fff", marginBottom: 24 },
  grid: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 },
  card: {
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 8,
    padding: 20,
  },
  name: { margin: 0, fontSize: 16, color: "#e94560" },
  desc: { fontSize: 13, color: "#aaa", margin: "8px 0" },
  details: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: {
    padding: "3px 8px",
    background: "#16213e",
    borderRadius: 4,
    fontSize: 11,
    color: "#888",
  },
  skills: { marginTop: 12 },
  skill: {
    padding: "3px 8px",
    background: "#1b5e20",
    borderRadius: 4,
    fontSize: 11,
    color: "#81c784",
  },
};

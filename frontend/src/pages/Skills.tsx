import { useSkills } from "../hooks/useApi";

const CATEGORY_LABELS: Record<string, string> = {
  research: "Research",
  script: "Script",
  visual: "Visual",
  music: "Music",
  growth: "Growth",
  qa: "QA",
};

export default function Skills() {
  const { skills, loading } = useSkills();

  if (loading) return <p style={{ color: "#888" }}>Loading...</p>;

  const grouped: Record<string, typeof skills> = {};
  skills.forEach((s) => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });

  return (
    <div>
      <h1 style={styles.h1}>Skills Registry</h1>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 24 }}>
          <h2 style={styles.cat}>{CATEGORY_LABELS[cat] || cat}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {items.map((s) => (
              <div key={s.id} style={styles.card}>
                <div style={styles.name}>{s.name}</div>
                <div style={styles.desc}>{s.description}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, color: "#fff", marginBottom: 24 },
  cat: { fontSize: 14, color: "#e94560", marginBottom: 12, textTransform: "uppercase" },
  card: {
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "12px 16px",
    minWidth: 180,
    flex: "0 0 auto",
  },
  name: { fontSize: 14, color: "#e0e0e0", fontWeight: 600 },
  desc: { fontSize: 12, color: "#888", marginTop: 4 },
};

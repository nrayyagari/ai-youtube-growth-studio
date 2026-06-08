import { useChannels, usePackages } from "../hooks/useApi";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { channels, loading } = useChannels();
  const { packages } = usePackages();

  if (loading) return <p style={{ color: "#888" }}>Loading...</p>;

  const approved = packages.filter((p) => p.status === "APPROVED");
  const needsWork = packages.filter((p) => p.status === "NEEDS_IMPROVEMENT");

  return (
    <div>
      <h1 style={styles.h1}>Dashboard</h1>
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardNum}>{channels.length}</div>
          <div style={styles.cardLabel}>Channels</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardNum}>{packages.length}</div>
          <div style={styles.cardLabel}>Packages</div>
        </div>
        <div style={{ ...styles.card, borderColor: "#4caf50" }}>
          <div style={{ ...styles.cardNum, color: "#4caf50" }}>{approved.length}</div>
          <div style={styles.cardLabel}>Approved</div>
        </div>
        <div style={{ ...styles.card, borderColor: "#ff9800" }}>
          <div style={{ ...styles.cardNum, color: "#ff9800" }}>{needsWork.length}</div>
          <div style={styles.cardLabel}>Need Work</div>
        </div>
      </div>

      {packages.length > 0 && (
        <>
          <h2 style={styles.h2}>Recent Packages</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {packages.slice(0, 10).map((pkg) => (
                <tr key={pkg.id} style={styles.tr}>
                  <td style={styles.td}>#{pkg.id}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.status,
                      background: pkg.status === "APPROVED" ? "#1b5e20" : pkg.status === "NEEDS_IMPROVEMENT" ? "#5c1a1a" : "#333",
                      color: pkg.status === "APPROVED" ? "#81c784" : pkg.status === "NEEDS_IMPROVEMENT" ? "#ef9a9a" : "#888",
                    }}>
                      {pkg.status}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(pkg.created_at).toLocaleDateString()}</td>
                  <td style={styles.td}>
                    <Link to={`/packages/${pkg.id}`} style={styles.link}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, marginBottom: 24, color: "#fff" },
  h2: { fontSize: 18, margin: "32px 0 16px", color: "#ccc" },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, maxWidth: 720 },
  card: {
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "20px 16px",
    textAlign: "center",
  },
  cardNum: { fontSize: 32, fontWeight: 700, color: "#e0e0e0" },
  cardLabel: { fontSize: 13, color: "#888", marginTop: 4 },
  table: { width: "100%", maxWidth: 720, borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#888", borderBottom: "1px solid #333" },
  tr: { borderBottom: "1px solid #222" },
  td: { padding: "10px 12px", fontSize: 14 },
  status: { padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  link: { color: "#e94560", textDecoration: "none", fontSize: 13 },
};

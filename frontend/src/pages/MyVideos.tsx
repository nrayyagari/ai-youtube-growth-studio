import { useState } from "react";
import { Link } from "react-router-dom";
import { useStorage } from "../contexts/StorageContext";

export default function MyVideos() {
  const { packages, loading } = useStorage();
  const [search, setSearch] = useState("");

  const filtered = packages.filter((pkg) => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return pkg.topic?.toLowerCase().includes(lower) || pkg.id?.toLowerCase().includes(lower);
  });

  if (loading) {
    return <div style={{ padding: 40, color: "#888" }}>Loading...</div>;
  }

  if (packages.length === 0) {
    return (
      <div style={styles.emptyPage}>
        <div style={styles.emptyCard}>
          <h2 style={styles.emptyH2}>No scripts yet</h2>
          <p style={styles.emptyText}>Generate your first AI-powered script.</p>
          <Link to="/workspace" style={styles.secondaryLink}>Check setup first</Link>
          <Link to="/generate" style={styles.emptyBtn}>Generate your first script →</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={styles.h1}>My Scripts</h1>
        <Link to="/generate" style={styles.generateBtn}>+ Generate New</Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input
          placeholder="Search scripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <span style={{ color: "#666", fontSize: 12 }}>{filtered.length} shown</span>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Topic</th>
            <th style={styles.th}>Reference</th>
            <th style={styles.th}>Created</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 50).map((pkg) => (
            <tr key={pkg.id} style={styles.tr}>
              <td style={styles.td}>{pkg.topic || `#${pkg.id?.slice(0, 8)}`}</td>
              <td style={styles.td}>{pkg.reference_used ? "✓" : "—"}</td>
              <td style={styles.td}>{pkg.created_at ? new Date(pkg.created_at).toLocaleDateString() : "—"}</td>
              <td style={styles.td}>
                <Link to={`/packages/${pkg.id}`} style={styles.link}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, color: "#fff", margin: 0 },
  generateBtn: { color: "#fff", background: "#e94560", padding: "10px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: 14 },
  searchInput: { padding: "6px 12px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 13, width: 200 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#888", borderBottom: "1px solid #333" },
  tr: { borderBottom: "1px solid #222" },
  td: { padding: "10px 12px", fontSize: 14 },
  link: { color: "#e94560", textDecoration: "none", fontSize: 13 },
  emptyPage: { minHeight: "60vh", display: "grid", placeItems: "center" },
  emptyCard: { textAlign: "center", background: "#181827", border: "1px solid #343448", borderRadius: 12, padding: 40, maxWidth: 400 },
  emptyH2: { color: "#fff", marginBottom: 8 },
  emptyText: { color: "#999", marginBottom: 20 },
  secondaryLink: { display: "inline-block", color: "#cbd5e1", textDecoration: "none", marginBottom: 12, fontSize: 13 },
  emptyBtn: { color: "#fff", background: "#e94560", padding: "12px 20px", borderRadius: 6, textDecoration: "none", fontWeight: 700, whiteSpace: "nowrap" },
};

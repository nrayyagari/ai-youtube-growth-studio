import { useState } from "react";
import { Link } from "react-router-dom";
import { usePackages } from "../hooks/useApi";
import { LoadingState, ErrorMessage } from "../components/ui/ErrorBoundary";

export default function MyVideos() {
  const { packages, loading, error, reload } = usePackages();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = (packages || []).filter((pkg) => {
    if (statusFilter && pkg.status !== statusFilter) return false;
    if (search) {
      const lower = search.toLowerCase();
      const sections = pkg.sections || [];
      const hasMatch = sections.some((s: any) => {
        try { return JSON.stringify(s.content).toLowerCase().includes(lower); } catch { return false; }
      });
      return hasMatch || String(pkg.id).includes(lower);
    }
    return true;
  });

  if (loading) return <LoadingState text="Loading your scripts..." />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  if (!packages || packages.length === 0) {
    return (
      <div style={styles.emptyPage}>
        <div style={styles.emptyCard}>
          <h2 style={styles.emptyH2}>No scripts yet</h2>
          <p style={styles.emptyText}>Generate your first AI-powered script package.</p>
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.select}>
          <option value="">All Status</option>
          <option value="APPROVED">Approved</option>
          <option value="NEEDS_IMPROVEMENT">Needs Work</option>
          <option value="DRAFT">Draft</option>
        </select>
        <span style={{ color: "#666", fontSize: 12 }}>{filtered.length} shown</span>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Scores</th>
            <th style={styles.th}>Created</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 50).map((pkg) => (
            <tr key={pkg.id} style={styles.tr}>
              <td style={styles.td}>#{pkg.id}</td>
              <td style={styles.td}>
                <span style={{
                  ...styles.status,
                  background: pkg.status === "APPROVED" ? "#1b5e20" : pkg.status === "NEEDS_IMPROVEMENT" ? "#5c1a1a" : "#333",
                  color: pkg.status === "APPROVED" ? "#4ade80" : pkg.status === "NEEDS_IMPROVEMENT" ? "#f87171" : "#999",
                }}>
                  {pkg.status === "NEEDS_IMPROVEMENT" ? "Needs Work" : pkg.status}
                </span>
              </td>
              <td style={styles.td}>
                {(pkg.growth_scores || []).slice(0, 2).map((gs: any) => (
                  <span key={gs.category} style={{ marginRight: 8, fontSize: 12, color: gs.score >= 85 ? "#4ade80" : "#fbbf24" }}>
                    {gs.score}
                  </span>
                ))}
              </td>
              <td style={styles.td}>{new Date(pkg.created_at).toLocaleDateString()}</td>
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
  select: { padding: "6px 10px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#888", borderBottom: "1px solid #333" },
  tr: { borderBottom: "1px solid #222" },
  td: { padding: "10px 12px", fontSize: 14 },
  status: { padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  link: { color: "#e94560", textDecoration: "none", fontSize: 13 },
  emptyPage: { minHeight: "60vh", display: "grid", placeItems: "center" },
  emptyCard: { textAlign: "center", background: "#181827", border: "1px solid #343448", borderRadius: 12, padding: 40, maxWidth: 400 },
  emptyH2: { color: "#fff", marginBottom: 8 },
  emptyText: { color: "#999", marginBottom: 20 },
  emptyBtn: { color: "#fff", background: "#e94560", padding: "12px 20px", borderRadius: 6, textDecoration: "none", fontWeight: 700 },
};

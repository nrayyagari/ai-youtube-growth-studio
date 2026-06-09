import { useChannels, usePackages } from "../hooks/useApi";
import { Link } from "react-router-dom";
import { LoadingState, ErrorMessage } from "../components/ui/ErrorBoundary";
import { useState, useMemo } from "react";

export default function Dashboard() {
  const { channels, loading, error, reload } = useChannels();
  const { packages } = usePackages();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  if (loading) return <LoadingState text="Loading dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  const filtered = useMemo(() => {
    return packages.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (search) {
        const lower = search.toLowerCase();
        const sections = p.sections || [];
        const hasMatch = sections.some((s: any) => {
          try {
            const c = JSON.parse(s.content);
            return JSON.stringify(c).toLowerCase().includes(lower);
          } catch { return false; }
        });
        return hasMatch || String(p.id).includes(lower);
      }
      return true;
    });
  }, [packages, search, statusFilter]);

  const approved = packages.filter((p) => p.status === "APPROVED");
  const needsWork = packages.filter((p) => p.status === "NEEDS_IMPROVEMENT");

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const bulkApprove = async () => {
    setBulkLoading(true);
    for (const id of selected) {
      try { await fetch(`/api/packages/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ override: true }) }); } catch {}
    }
    setSelected(new Set());
    setBulkLoading(false);
    reload();
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} packages?`)) return;
    setBulkLoading(true);
    for (const id of selected) {
      try { await fetch(`/api/packages/${id}`, { method: "DELETE" }); } catch {}
    }
    setSelected(new Set());
    setBulkLoading(false);
    reload();
  };

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={styles.h2}>Packages</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                placeholder="Search packages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 13, width: 180 }}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 13 }}>
                <option value="">All Status</option>
                <option value="APPROVED">Approved</option>
                <option value="NEEDS_IMPROVEMENT">Needs Work</option>
                <option value="DRAFT">Draft</option>
              </select>
              {selected.size > 0 && (
                <>
                  <button onClick={bulkApprove} disabled={bulkLoading} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4ade80", background: "transparent", color: "#4ade80", cursor: "pointer", fontSize: 12 }}>
                    Approve {selected.size}
                  </button>
                  <button onClick={bulkDelete} disabled={bulkLoading} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #f87171", background: "transparent", color: "#f87171", cursor: "pointer", fontSize: 12 }}>
                    Delete {selected.size}
                  </button>
                </>
              )}
              <span style={{ color: "#666", fontSize: 12 }}>{filtered.length} shown</span>
            </div>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 30 }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((pkg) => (
                <tr key={pkg.id} style={styles.tr}>
                  <td style={styles.td}><input type="checkbox" checked={selected.has(pkg.id)} onChange={() => toggleSelect(pkg.id)} /></td>
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

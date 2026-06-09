import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Channel } from "../lib/types";

interface Snapshot {
  id: number;
  snapshot_date: string;
  views: number;
  watch_time_minutes: number;
  subscribers: number;
  avg_ctr: number;
  avg_retention: number;
  top_videos: string;
  demographics: string;
}

interface Comparison {
  latest: Snapshot;
  previous: Snapshot;
  changes_pct: Record<string, number>;
}

interface Recommendation {
  id: number;
  recommendation_type: string;
  title: string;
  description: string;
  priority: number;
  based_on: string;
}

export default function Analytics() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ views: 0, watch_time_minutes: 0, subscribers: 0, avg_ctr: 0, avg_retention: 0 });

  useEffect(() => {
    api.listChannels().then(setChannels).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    loadData(selectedChannel);
  }, [selectedChannel]);

  const loadData = async (chId: number) => {
    setError("");
    try {
      const [snaps, recs] = await Promise.all([
        fetch(`/api/channels/${chId}/analytics`).then((r) => r.json()),
        fetch(`/api/channels/${chId}/recommendations`).then((r) => r.json()),
      ]);
      setSnapshots(Array.isArray(snaps) ? snaps : []);
      setRecommendations(Array.isArray(recs) ? recs : []);
      if (Array.isArray(snaps) && snaps.length >= 2) {
        fetch(`/api/channels/${chId}/analytics/compare`)
          .then((r) => r.json())
          .then(setComparison)
          .catch(() => {});
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;
    setLoading(true);
    setError("");
    try {
      await fetch(`/api/channels/${selectedChannel}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      loadData(selectedChannel);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleGenerateRecs = async () => {
    if (!selectedChannel) return;
    setLoading(true);
    try {
      await fetch(`/api/channels/${selectedChannel}/recommendations/generate`, { method: "POST" });
      loadData(selectedChannel);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleYoutubeSync = async () => {
    if (!selectedChannel) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/youtube/sync/${selectedChannel}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Sync failed");
      }
      const data = await res.json();
      const stats = data._channel_stats;
      if (stats) {
        setError(`Synced: ${stats.title} — ${stats.subscribers?.toLocaleString()} subs, ${stats.total_views?.toLocaleString()} views`);
      }
      loadData(selectedChannel);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Analytics Dashboard</h2>

      <div style={styles.channelSelect}>
        <select
          value={selectedChannel ?? ""}
          onChange={(e) => setSelectedChannel(Number(e.target.value) || null)}
          style={styles.select}
        >
          <option value="">-- Select Channel --</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedChannel && (
          <button onClick={handleYoutubeSync} disabled={loading} style={styles.syncBtn}>
            {loading ? "Syncing..." : "Sync from YouTube"}
          </button>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {selectedChannel && (
        <>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Manual Snapshot Entry</h3>
            <form onSubmit={handleSubmit} style={styles.snapshotForm}>
              <div style={styles.fieldRow}>
                <label style={styles.label}>Views <input type="number" value={form.views} onChange={(e) => setForm({ ...form, views: Number(e.target.value) })} style={styles.smallInput} /></label>
                <label style={styles.label}>Watch Time (min) <input type="number" step="0.1" value={form.watch_time_minutes} onChange={(e) => setForm({ ...form, watch_time_minutes: Number(e.target.value) })} style={styles.smallInput} /></label>
                <label style={styles.label}>Subscribers <input type="number" value={form.subscribers} onChange={(e) => setForm({ ...form, subscribers: Number(e.target.value) })} style={styles.smallInput} /></label>
                <label style={styles.label}>Avg CTR (%) <input type="number" step="0.1" value={form.avg_ctr} onChange={(e) => setForm({ ...form, avg_ctr: Number(e.target.value) })} style={styles.smallInput} /></label>
                <label style={styles.label}>Avg Retention (%) <input type="number" step="0.1" value={form.avg_retention} onChange={(e) => setForm({ ...form, avg_retention: Number(e.target.value) })} style={styles.smallInput} /></label>
              </div>
              <button type="submit" disabled={loading} style={styles.btn}>Save Snapshot</button>
            </form>
          </div>

          {comparison && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Period Comparison</h3>
              <div style={styles.compareGrid}>
                {Object.entries(comparison.changes_pct).map(([key, val]) => (
                  <div key={key} style={styles.compareItem}>
                    <span style={styles.compareLabel}>{key.replace(/_/g, " ")}</span>
                    <span style={{ ...styles.compareValue, color: val > 0 ? "#4ade80" : val < 0 ? "#f87171" : "#888" }}>
                      {val > 0 ? "+" : ""}{val}%
                    </span>
                  </div>
                ))}
              </div>
              <div style={styles.compareDates}>
                {comparison.previous.snapshot_date} → {comparison.latest.snapshot_date}
              </div>
            </div>
          )}

          <div style={styles.twoCol}>
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Snapshots</h3>
              {snapshots.slice(0, 10).map((s) => (
                <div key={s.id} style={styles.snapshotRow}>
                  <span style={styles.date}>{s.snapshot_date}</span>
                  <span style={styles.metric}>{s.views.toLocaleString()} views</span>
                  <span style={styles.metric}>{s.subscribers.toLocaleString()} subs</span>
                  <span style={styles.metric}>{s.avg_ctr}% CTR</span>
                  <span style={styles.metric}>{s.avg_retention}% ret</span>
                </div>
              ))}
              {snapshots.length === 0 && <p style={styles.empty}>No snapshots yet.</p>}
            </div>

            <div style={styles.card}>
              <div style={styles.recHeader}>
                <h3 style={styles.sectionTitle}>Recommendations</h3>
                <button onClick={handleGenerateRecs} disabled={loading} style={styles.genBtn}>
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
              {recommendations.map((r) => (
                <div key={r.id} style={styles.recRow}>
                  <span style={styles.recType}>{r.recommendation_type}</span>
                  <div style={styles.recBody}>
                    <strong style={styles.recTitle}>{r.title}</strong>
                    {r.description && <p style={styles.recDesc}>{r.description}</p>}
                  </div>
                  <span style={styles.recPriority}>P{r.priority}</span>
                </div>
              ))}
              {recommendations.length === 0 && <p style={styles.empty}>No recommendations yet.</p>}
            </div>
          </div>

          {snapshots.length > 0 && (() => {
            const latest = snapshots[0];
            let topVideos: any[] = [];
            try { topVideos = JSON.parse(latest.top_videos || "[]"); } catch {}
            let demographics: any = {};
            try { demographics = JSON.parse(latest.demographics || "{}"); } catch {}

            if (topVideos.length > 0 || Object.keys(demographics).length > 0) {
              return (
                <div style={{ display: "grid", gridTemplateColumns: Object.keys(demographics).length > 0 ? "1fr 1fr" : "1fr", gap: 16, marginTop: 16 }}>
                  {topVideos.length > 0 && (
                    <div style={styles.card}>
                      <h3 style={styles.sectionTitle}>Top Videos</h3>
                      {topVideos.slice(0, 5).map((v: any, i: number) => (
                        <div key={i} style={styles.snapshotRow}>
                          <span style={styles.date}>{i + 1}.</span>
                          <span style={{ color: "#ccc", fontSize: 12, flex: 1 }}>{v.title || v.video_id || "Unknown"}</span>
                          <span style={styles.metric}>{(v.views || 0).toLocaleString()} views</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(demographics).length > 0 && (
                    <div style={styles.card}>
                      <h3 style={styles.sectionTitle}>Demographics</h3>
                      {demographics.age_groups && Object.keys(demographics.age_groups).length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>Age Groups</span>
                          {Object.entries(demographics.age_groups).map(([age, pct]: [string, any]) => (
                            <div key={age} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                              <span style={{ color: "#aaa" }}>{age}</span>
                              <div style={{ flex: 1, margin: "0 8px", height: 6, background: "#333", borderRadius: 3 }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: "#e94560", borderRadius: 3 }} />
                              </div>
                              <span style={{ color: "#ccc", minWidth: 40, textAlign: "right" }}>{pct}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {demographics.gender && Object.keys(demographics.gender).length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>Gender</span>
                          {Object.entries(demographics.gender).map(([g, pct]: [string, any]) => (
                            <div key={g} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                              <span style={{ color: "#aaa" }}>{g}</span>
                              <span style={{ color: "#ccc" }}>{pct}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {demographics.geography && Object.keys(demographics.geography).length > 0 && (
                        <div>
                          <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>Top Geographies</span>
                          {Object.entries(demographics.geography).slice(0, 5).map(([geo, pct]: [string, any]) => (
                            <div key={geo} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                              <span style={{ color: "#aaa" }}>{geo}</span>
                              <span style={{ color: "#ccc" }}>{pct}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 1100 },
  title: { fontSize: 22, marginBottom: 20, color: "#e0e0e0" },
  channelSelect: { marginBottom: 20, display: "flex", gap: 12, alignItems: "center" },
  select: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid #444",
    background: "#1e1e2e",
    color: "#eee",
    fontSize: 14,
    minWidth: 250,
  },
  syncBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "1px solid #4ade80",
    background: "transparent",
    color: "#4ade80",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  card: {
    background: "#1e1e2e",
    borderRadius: 8,
    padding: "18px 22px",
    border: "1px solid #333",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, margin: "0 0 14px", color: "#ccc" },
  snapshotForm: { display: "flex", flexDirection: "column", gap: 12 },
  fieldRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  label: { fontSize: 12, color: "#888", display: "flex", flexDirection: "column", gap: 4 },
  smallInput: {
    width: 110,
    padding: "6px 10px",
    borderRadius: 4,
    border: "1px solid #444",
    background: "#0f0f1a",
    color: "#eee",
    fontSize: 13,
  },
  btn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#e94560",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  error: { color: "#ff6b6b", marginBottom: 12, fontSize: 13 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  snapshotRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 0",
    borderBottom: "1px solid #2a2a3a",
    fontSize: 13,
  },
  date: { color: "#e94560", minWidth: 90 },
  metric: { color: "#aaa", fontSize: 12 },
  recHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  genBtn: {
    padding: "6px 14px",
    borderRadius: 4,
    border: "1px solid #e94560",
    background: "transparent",
    color: "#e94560",
    cursor: "pointer",
    fontSize: 12,
  },
  recRow: {
    display: "flex",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid #2a2a3a",
    alignItems: "flex-start",
    fontSize: 13,
  },
  recType: {
    padding: "2px 6px",
    borderRadius: 3,
    background: "#16213e",
    color: "#aaa",
    fontSize: 10,
    textTransform: "uppercase",
    flexShrink: 0,
    marginTop: 2,
  },
  recBody: { flex: 1 },
  recTitle: { color: "#eee", fontSize: 13 },
  recDesc: { color: "#888", fontSize: 12, margin: "2px 0 0" },
  recPriority: { color: "#e94560", fontSize: 12, fontWeight: 600 },
  compareGrid: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 },
  compareItem: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 },
  compareLabel: { fontSize: 10, color: "#888", textTransform: "uppercase" },
  compareValue: { fontSize: 20, fontWeight: 700 },
  compareDates: { fontSize: 11, color: "#666", marginTop: 8 },
  empty: { color: "#666", fontSize: 14, textAlign: "center", padding: 30 },
};

import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Channel } from "../lib/types";

interface ChannelStat {
  channel_id: string;
  title: string;
  subscribers: number;
  total_views: number;
  video_count: number;
  thumbnail: string;
}

export default function ChannelAnalytics() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [stats, setStats] = useState<ChannelStat | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [topVideos, setTopVideos] = useState<any[]>([]);
  const [demos, setDemos] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api.listChannels().then(setChannels).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      setStats(null);
      setAnalytics(null);
      setTopVideos([]);
      setDemos(null);
    }
  }, [selectedChannel]);

  const handleSync = async () => {
    if (!selectedChannel) return;
    setSyncing(true);
    setError("");
    try {
      const r = await fetch(`/api/youtube/sync/${selectedChannel}`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).detail || "Sync failed");
      const data = await r.json();
      
      setStats(data._channel_stats || null);
      
      const snap = await fetch(`/api/channels/${selectedChannel}/analytics/latest`).then(r => r.json());
      setAnalytics(snap);
      
      try { setTopVideos(JSON.parse(snap.top_videos || "[]").slice(0, 10)); } catch { setTopVideos([]); }
      try { setDemos(JSON.parse(snap.demographics || "{}")); } catch { setDemos({}); }
    } catch (e: any) {
      setError(e.message);
    }
    setSyncing(false);
  };

  const handleManualRefresh = async () => {
    if (!selectedChannel) return;
    setLoading(true);
    try {
      const snap = await fetch(`/api/channels/${selectedChannel}/analytics/latest`).then(r => r.json());
      setAnalytics(snap);
      try { setTopVideos(JSON.parse(snap.top_videos || "[]").slice(0, 10)); } catch { setTopVideos([]); }
      try { setDemos(JSON.parse(snap.demographics || "{}")); } catch { setDemos({}); }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, color: "#e0e0e0", margin: 0 }}>Channel Analytics</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleManualRefresh} disabled={loading} style={styles.smallBtn}>Refresh Snapshots</button>
          <button onClick={handleSync} disabled={syncing} style={{ ...styles.syncBtn, opacity: syncing ? 0.5 : 1 }}>
            {syncing ? "Syncing..." : "Sync from YouTube"}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <select style={styles.select} value={selectedChannel || ""} onChange={(e) => setSelectedChannel(Number(e.target.value) || null)}>
          <option value="">Select Channel...</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
          <div style={styles.statCard}>
            <span style={{ color: "#888", fontSize: 11 }}>Subscribers</span>
            <span style={{ color: "#4ade80", fontSize: 22, fontWeight: 800 }}>{stats.subscribers?.toLocaleString()}</span>
          </div>
          <div style={styles.statCard}>
            <span style={{ color: "#888", fontSize: 11 }}>Total Views</span>
            <span style={{ color: "#e0e0e0", fontSize: 22, fontWeight: 800 }}>{stats.total_views?.toLocaleString()}</span>
          </div>
          <div style={styles.statCard}>
            <span style={{ color: "#888", fontSize: 11 }}>Videos</span>
            <span style={{ color: "#a371f7", fontSize: 22, fontWeight: 800 }}>{stats.video_count}</span>
          </div>
          <div style={styles.statCard}>
            <span style={{ color: "#888", fontSize: 11 }}>Avg CTR</span>
            <span style={{ color: "#fbbf24", fontSize: 22, fontWeight: 800 }}>{analytics?.avg_ctr || "-"}%</span>
          </div>
          <div style={styles.statCard}>
            <span style={{ color: "#888", fontSize: 11 }}>Avg Retention</span>
            <span style={{ color: "#e94560", fontSize: 22, fontWeight: 800 }}>{analytics?.avg_retention || "-"}%</span>
          </div>
        </div>
      )}

      {!stats && selectedChannel && !syncing && (
        <div style={{ ...styles.card, textAlign: "center", padding: 40 }}>
          <p style={{ color: "#666", marginBottom: 12 }}>No YouTube data synced yet.</p>
          <button onClick={handleSync} style={styles.syncBtn}>Sync from YouTube</button>
        </div>
      )}

      {topVideos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={styles.card}>
            <h3 style={{ fontSize: 14, color: "#ccc", marginBottom: 12 }}>Top Videos</h3>
            {topVideos.slice(0, 8).map((v: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #2a2a3a", fontSize: 12 }}>
                <span style={{ color: "#aaa", flex: 1 }}>
                  <span style={{ color: "#e94560", marginRight: 6 }}>{i + 1}.</span>
                  {v.title || v.video_id || "Unknown"}
                </span>
                <span style={{ color: "#888", minWidth: 70, textAlign: "right" }}>{(v.views || 0).toLocaleString()} views</span>
              </div>
            ))}
          </div>

          {demos && Object.keys(demos).length > 0 && (
            <div style={styles.card}>
              <h3 style={{ fontSize: 14, color: "#ccc", marginBottom: 12 }}>Audience Demographics</h3>
              {demos.age_groups && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>Age</span>
                  {Object.entries(demos.age_groups).map(([age, pct]: [string, any]) => (
                    <div key={age} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", fontSize: 11 }}>
                      <span style={{ color: "#aaa", minWidth: 30 }}>{age}</span>
                      <div style={{ flex: 1, height: 5, background: "#333", borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#e94560", borderRadius: 3 }} />
                      </div>
                      <span style={{ color: "#888", minWidth: 35, textAlign: "right" }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              )}
              {demos.gender && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>Gender</span>
                  {Object.entries(demos.gender).map(([g, pct]: [string, any]) => (
                    <div key={g} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}>
                      <span style={{ color: "#aaa" }}>{g}</span>
                      <span style={{ color: "#888" }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              )}
              {demos.geography && (
                <div>
                  <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>Geography</span>
                  {Object.entries(demos.geography).slice(0, 5).map(([geo, pct]: [string, any]) => (
                    <div key={geo} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 11 }}>
                      <span style={{ color: "#aaa" }}>{geo}</span>
                      <span style={{ color: "#888" }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  select: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, minWidth: 250 },
  card: { background: "#1e1e2e", borderRadius: 8, padding: "16px 20px", border: "1px solid #333" },
  statCard: { background: "#1e1e2e", borderRadius: 8, padding: "16px", border: "1px solid #333", textAlign: "center", display: "flex", flexDirection: "column", gap: 4 },
  syncBtn: { padding: "10px 20px", borderRadius: 6, border: "1px solid #4ade80", background: "transparent", color: "#4ade80", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  smallBtn: { padding: "8px 14px", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 13 },
  error: { marginBottom: 12, padding: 12, background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.3)", borderRadius: 6, color: "#ef9a9a", fontSize: 13 },
};

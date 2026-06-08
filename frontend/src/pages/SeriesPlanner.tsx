import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Channel } from "../lib/types";

interface Series {
  id: number;
  channel_id: number;
  name: string;
  description: string;
  status: string;
  created_at: string;
}

interface Episode {
  id: number;
  series_id: number;
  package_id: number | null;
  episode_number: number;
  title: string;
  description: string;
  arc_position: string;
  status: string;
  created_at: string;
}

export default function SeriesPlanner() {
  const { channelId } = useParams<{ channelId: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState("");

  const chId = Number(channelId);

  useEffect(() => {
    if (!chId) return;
    api.getChannel(chId).then(setChannel).catch(() => setError("Channel not found"));
  }, [chId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: chId, name: newName, description: newDesc }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      setNewName("");
      setNewDesc("");
      loadSeries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadSeries = () => {
    fetch(`/api/series?channel_id=${chId}`)
      .then((r) => r.json())
      .then(setSeries)
      .catch(() => {});
  };

  const loadEpisodes = (seriesId: number) => {
    setSelectedSeries(seriesId);
    fetch(`/api/series/${seriesId}/episodes`)
      .then((r) => r.json())
      .then(setEpisodes)
      .catch(() => {});
  };

  if (!channelId) {
    return <div style={styles.container}><h2>Select a channel to plan series</h2></div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        Series Planner {channel && <span style={styles.channelName}>— {channel.name}</span>}
      </h2>

      <form onSubmit={handleCreate} style={styles.form}>
        <input
          type="text"
          placeholder="Series name (e.g. 'AI History Deep Dive')"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={styles.input}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          style={{ ...styles.input, flex: 2 }}
        />
        <button type="submit" disabled={!newName.trim()} style={styles.btn}>
          Create Series
        </button>
      </form>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.layout}>
        <div style={styles.seriesList}>
          <h3 style={styles.sectionTitle}>Series</h3>
          {series.length === 0 && <p style={styles.empty}>No series yet. Create one above.</p>}
          {series.map((s) => (
            <div
              key={s.id}
              style={{
                ...styles.seriesCard,
                ...(selectedSeries === s.id ? styles.seriesCardActive : {}),
              }}
              onClick={() => loadEpisodes(s.id)}
            >
              <h4 style={styles.seriesName}>{s.name}</h4>
              <p style={styles.seriesDesc}>{s.description}</p>
              <span style={styles.status}>{s.status}</span>
            </div>
          ))}
        </div>

        <div style={styles.episodeList}>
          <h3 style={styles.sectionTitle}>
            {selectedSeries ? "Episodes" : "Select a series to view episodes"}
          </h3>
          {episodes.map((ep) => (
            <div key={ep.id} style={styles.episodeCard}>
              <span style={styles.epNum}>#{ep.episode_number}</span>
              <div style={styles.epBody}>
                <h4 style={styles.epTitle}>{ep.title || "Untitled Episode"}</h4>
                {ep.description && <p style={styles.epDesc}>{ep.description}</p>}
                {ep.arc_position && (
                  <span style={styles.arcTag}>{ep.arc_position}</span>
                )}
              </div>
              <span style={styles.epStatus}>{ep.status}</span>
            </div>
          ))}
          {selectedSeries && episodes.length === 0 && (
            <p style={styles.empty}>No episodes planned yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 1100 },
  title: { fontSize: 22, marginBottom: 20, color: "#e0e0e0" },
  channelName: { color: "#888", fontSize: 16 },
  form: { display: "flex", gap: 12, marginBottom: 24 },
  input: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid #444",
    background: "#1e1e2e",
    color: "#eee",
    fontSize: 14,
  },
  btn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    background: "#e94560",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  error: { color: "#ff6b6b", marginBottom: 12, fontSize: 13 },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  seriesList: {},
  seriesCard: {
    background: "#1e1e2e",
    borderRadius: 8,
    padding: "14px 18px",
    border: "1px solid #333",
    marginBottom: 8,
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  seriesCardActive: { borderColor: "#e94560" },
  seriesName: { fontSize: 15, margin: "0 0 4px", color: "#eee" },
  seriesDesc: { fontSize: 12, color: "#888", margin: "0 0 8px" },
  status: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 3,
    background: "#16213e",
    color: "#aaa",
  },
  sectionTitle: { fontSize: 16, marginBottom: 12, color: "#ccc" },
  episodeList: {},
  episodeCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#1e1e2e",
    borderRadius: 8,
    padding: "12px 16px",
    border: "1px solid #333",
    marginBottom: 6,
  },
  epNum: { fontSize: 18, fontWeight: 700, color: "#e94560", minWidth: 40 },
  epBody: { flex: 1 },
  epTitle: { fontSize: 14, margin: "0 0 2px", color: "#eee" },
  epDesc: { fontSize: 12, color: "#888", margin: "0 0 4px" },
  arcTag: {
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 3,
    background: "#2a2a4a",
    color: "#aaa",
  },
  epStatus: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 3,
    background: "#16213e",
    color: "#aaa",
  },
  empty: { color: "#666", fontSize: 14, textAlign: "center", padding: 40 },
};

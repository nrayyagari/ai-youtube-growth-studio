import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Channel, ReferenceVideo } from "../lib/types";

export default function ReferenceVideos() {
  const { channelId } = useParams<{ channelId: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<ReferenceVideo[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chId = Number(channelId);

  useEffect(() => {
    if (!chId) return;
    api.getChannel(chId).then(setChannel).catch(() => setError("Channel not found"));
    loadVideos();
  }, [chId]);

  const loadVideos = () => {
    if (!chId) return;
    api.listReferenceVideos(chId).then(setVideos).catch(() => {});
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.addReferenceVideo(chId, url.trim());
      setUrl("");
      loadVideos();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    await api.deleteReferenceVideo(id);
    loadVideos();
  };

  if (!channelId) {
    return <div style={styles.container}><h2>Select a channel to manage reference videos</h2></div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        Reference Videos {channel && <span style={styles.channelName}>— {channel.name}</span>}
      </h2>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          type="text"
          placeholder="Paste YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={styles.input}
        />
        <button type="submit" disabled={loading || !url.trim()} style={styles.btn}>
          {loading ? "Adding..." : "Add Reference Video"}
        </button>
      </form>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {videos.map((v) => (
          <div key={v.id} style={styles.card}>
            {v.thumbnail_url && (
              <img src={v.thumbnail_url} alt={v.title} style={styles.thumb} />
            )}
            <div style={styles.cardBody}>
              <h3 style={styles.videoTitle}>{v.title || "Untitled"}</h3>
              <p style={styles.meta}>Channel: {v.channel_name || "Unknown"}</p>
              <p style={styles.meta}>
                Transcript: {v.transcript ? `${v.transcript.length.toLocaleString()} chars` : "Not available"}
              </p>
              <button onClick={() => handleDelete(v.id)} style={styles.deleteBtn}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {videos.length === 0 && !loading && (
          <p style={styles.empty}>No reference videos added yet. Paste a YouTube URL above.</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 900 },
  title: { fontSize: 22, marginBottom: 20, color: "#e0e0e0" },
  channelName: { color: "#888", fontSize: 16 },
  form: { display: "flex", gap: 12, marginBottom: 16 },
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
  grid: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    display: "flex",
    background: "#1e1e2e",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #333",
  },
  thumb: { width: 180, height: 100, objectFit: "cover", flexShrink: 0 },
  cardBody: { padding: "12px 16px", flex: 1 },
  videoTitle: { fontSize: 15, margin: "0 0 4px", color: "#eee" },
  meta: { fontSize: 12, color: "#888", margin: "2px 0" },
  deleteBtn: {
    marginTop: 8,
    padding: "4px 12px",
    borderRadius: 4,
    border: "1px solid #e94560",
    background: "transparent",
    color: "#e94560",
    cursor: "pointer",
    fontSize: 12,
  },
  empty: { color: "#666", fontSize: 14, textAlign: "center", padding: 40 },
};

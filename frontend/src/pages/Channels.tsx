import { useChannels } from "../hooks/useApi";
import { useState } from "react";
import { Link } from "react-router-dom";
import ChannelForm from "../components/forms/ChannelForm";

export default function Channels() {
  const { channels, loading, create, remove } = useChannels();
  const [showForm, setShowForm] = useState(false);

  if (loading) return <p style={{ color: "#888" }}>Loading...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={styles.h1}>Channels</h1>
        <button onClick={() => setShowForm(!showForm)} style={styles.btn}>
          {showForm ? "Cancel" : "+ New Channel"}
        </button>
      </div>

      {showForm && (
        <div style={styles.formBox}>
          <ChannelForm
            onSubmit={async (data) => {
              await create(data);
              setShowForm(false);
            }}
          />
        </div>
      )}

      {channels.length === 0 ? (
        <p style={{ color: "#666" }}>No channels yet. Create one to get started.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
          {channels.map((ch) => (
            <div key={ch.id} style={styles.row}>
              <Link to={`/packages?channel=${ch.id}`} style={styles.name}>{ch.name}</Link>
              <span style={styles.meta}>{ch.niche || "No niche"} · {ch.language}</span>
              <span style={styles.meta}>{ch.content_mode?.replace("_", " ")}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => remove(ch.id)} style={styles.del}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, color: "#fff", margin: 0 },
  btn: {
    padding: "10px 20px",
    background: "#e94560",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  formBox: { marginBottom: 24 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 16px",
    background: "#1a1a2e",
    borderRadius: 8,
    border: "1px solid #333",
  },
  name: { color: "#e94560", textDecoration: "none", fontWeight: 600, fontSize: 15 },
  meta: { color: "#888", fontSize: 12 },
  del: {
    padding: "6px 12px",
    background: "transparent",
    border: "1px solid #5c1a1a",
    borderRadius: 4,
    color: "#ef9a9a",
    cursor: "pointer",
    fontSize: 12,
  },
};

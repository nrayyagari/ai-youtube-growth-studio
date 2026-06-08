import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Channel, StyleProfile } from "../lib/types";

export default function StyleProfiles() {
  const { channelId } = useParams<{ channelId: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chId = Number(channelId);

  useEffect(() => {
    if (!chId) return;
    api.getChannel(chId).then(setChannel).catch(() => setError("Channel not found"));
    loadProfiles();
  }, [chId]);

  const loadProfiles = () => {
    if (!chId) return;
    api.listStyleProfiles(chId).then(setProfiles).catch(() => {});
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.generateStyleProfile(chId, name.trim());
      setName("");
      loadProfiles();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    await api.deleteStyleProfile(id);
    loadProfiles();
  };

  if (!channelId) {
    return <div style={styles.container}><h2>Select a channel to manage style profiles</h2></div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        Style Profiles {channel && <span style={styles.channelName}>— {channel.name}</span>}
      </h2>

      <form onSubmit={handleGenerate} style={styles.form}>
        <input
          type="text"
          placeholder="Profile name (e.g. 'Chill Tech Style')"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />
        <button type="submit" disabled={loading || !name.trim()} style={styles.btn}>
          {loading ? "Analyzing..." : "Generate Style Profile"}
        </button>
      </form>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {profiles.map((p) => (
          <div key={p.id} style={styles.card}>
            <h3 style={styles.profileName}>{p.name}</h3>
            <div style={styles.fields}>
              {p.visual_style && <Field label="Visual Style" value={p.visual_style} />}
              {p.editing_style && <Field label="Editing Style" value={p.editing_style} />}
              {p.tone && <Field label="Tone" value={p.tone} />}
              {p.music_preferences && <Field label="Music" value={p.music_preferences} />}
              {p.pacing && <Field label="Pacing" value={p.pacing} />}
              {p.hooks && <Field label="Hooks" value={p.hooks} />}
              {p.thumbnails_style && <Field label="Thumbnails" value={p.thumbnails_style} />}
              {p.content_patterns && Object.keys(p.content_patterns).length > 0 && (
                <div style={styles.fieldBlock}>
                  <span style={styles.fieldLabel}>Content Patterns</span>
                  {Object.entries(p.content_patterns).map(([k, v]) => (
                    <div key={k} style={styles.patternItem}>
                      <strong>{k.replace(/_/g, " ")}:</strong> {String(v)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {p.raw_analysis?.score && (
              <div style={styles.scores}>
                {Object.entries(p.raw_analysis.score as Record<string, { score: number; explanation: string }>).map(([k, v]) => (
                  <span key={k} style={styles.scoreBadge}>
                    {k.replace(/_/g, " ")}: <strong>{v.score}</strong>
                  </span>
                ))}
              </div>
            )}
            <button onClick={() => handleDelete(p.id)} style={styles.deleteBtn}>Delete</button>
          </div>
        ))}
        {profiles.length === 0 && (
          <p style={styles.empty}>
            No style profiles yet. Add reference videos first, then generate a profile.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.fieldBlock}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={styles.fieldValue}>{value}</span>
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
  grid: { display: "flex", flexDirection: "column", gap: 16 },
  card: {
    background: "#1e1e2e",
    borderRadius: 8,
    padding: "20px 24px",
    border: "1px solid #333",
  },
  profileName: { fontSize: 17, margin: "0 0 16px", color: "#e94560" },
  fields: { display: "flex", flexDirection: "column", gap: 10 },
  fieldBlock: { display: "flex", flexDirection: "column", gap: 2 },
  fieldLabel: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { fontSize: 14, color: "#ccc", lineHeight: 1.5 },
  patternItem: { fontSize: 13, color: "#aaa", paddingLeft: 8, borderLeft: "2px solid #444" },
  scores: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  scoreBadge: {
    padding: "4px 10px",
    borderRadius: 4,
    background: "#16213e",
    fontSize: 12,
    color: "#aaa",
  },
  deleteBtn: {
    marginTop: 14,
    padding: "4px 14px",
    borderRadius: 4,
    border: "1px solid #e94560",
    background: "transparent",
    color: "#e94560",
    cursor: "pointer",
    fontSize: 12,
  },
  empty: { color: "#666", fontSize: 14, textAlign: "center", padding: 40 },
};

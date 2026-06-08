import { useState, type FormEvent } from "react";

interface Props {
  onSubmit: (data: any) => Promise<void>;
  initial?: any;
}

export default function ChannelForm({ onSubmit, initial }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [niche, setNiche] = useState(initial?.niche || "");
  const [audience, setAudience] = useState(initial?.audience || "");
  const [language, setLanguage] = useState(initial?.language || "en");
  const [contentMode, setContentMode] = useState(initial?.content_mode || "single_video");
  const [monetization, setMonetization] = useState(initial?.monetization_goal || "");
  const [frequency, setFrequency] = useState(initial?.upload_frequency || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSubmit({
      name,
      niche,
      audience,
      language,
      content_mode: contentMode,
      monetization_goal: monetization,
      upload_frequency: frequency,
    });
    setSaving(false);
    if (!initial) {
      setName("");
      setNiche("");
      setAudience("");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.row}>
        <label style={styles.label}>
          Channel Name *
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label style={styles.label}>
          Language
          <select style={styles.input} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="hi">Hindi</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </label>
      </div>
      <div style={styles.row}>
        <label style={styles.label}>
          Niche
          <input style={styles.input} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="AI, Tech, Education..." />
        </label>
        <label style={styles.label}>
          Target Audience
          <input style={styles.input} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Developers, Beginners..." />
        </label>
      </div>
      <div style={styles.row}>
        <label style={styles.label}>
          Content Mode
          <select style={styles.input} value={contentMode} onChange={(e) => setContentMode(e.target.value)}>
            <option value="single_video">Single Video</option>
            <option value="episode_series">Episode Series</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label style={styles.label}>
          Upload Frequency
          <input style={styles.input} value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Weekly, Daily..." />
        </label>
      </div>
      <label style={styles.label}>
        Monetization Goal
        <input style={styles.input} value={monetization} onChange={(e) => setMonetization(e.target.value)} placeholder="Ad revenue, sponsorships..." />
      </label>
      <button type="submit" disabled={saving} style={styles.btn}>
        {saving ? "Saving..." : initial ? "Update Channel" : "Create Channel"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 600,
  },
  row: {
    display: "flex",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: 1,
    fontSize: 13,
    color: "#aaa",
  },
  input: {
    padding: "10px 12px",
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    padding: "12px 24px",
    background: "#e94560",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
};

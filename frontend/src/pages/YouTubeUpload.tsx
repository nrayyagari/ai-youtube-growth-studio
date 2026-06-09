import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Channel, VideoPackage } from "../lib/types";

export default function YouTubeUpload() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [packages, setPackages] = useState<VideoPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", description: "", tags: "", privacy: "private" });
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [oauthStatus, setOauthStatus] = useState<any>(null);

  useEffect(() => {
    api.listChannels().then(setChannels).catch(() => {});
    api.listPackages().then((data) => setPackages(Array.isArray(data) ? data.filter((p: any) => p.status === "APPROVED") : [])).catch(() => {});
    checkOAuth();
  }, []);

  useEffect(() => {
    if (selectedPackage) loadPackageMeta(selectedPackage);
  }, [selectedPackage]);

  const checkOAuth = async () => {
    try {
      const r = await fetch("/api/youtube/oauth/status");
      setOauthStatus(await r.json());
    } catch { setOauthStatus(null); }
  };

  const loadPackageMeta = async (id: number) => {
    try {
      const pkg = await api.getPackage(id);
      const scriptSection = pkg.sections?.find((s: any) => s.section_type === "script");
      let script = "";
      try {
        const content = JSON.parse(scriptSection?.content || "{}");
        script = content.script || "";
      } catch {}

      const titlesSection = pkg.sections?.find((s: any) => s.section_type === "titles");
      let titles = "";
      try {
        const content = JSON.parse(titlesSection?.content || "{}");
        titles = content.titles?.map((t: any) => t.title).join(" | ") || content.recommended_title || "";
      } catch {}

      const channel = channels.find((c) => c.id === pkg.channel_id);
      const tags = [channel?.niche || "", "ai generated", "faceless"].filter(Boolean).join(", ");

      setForm({
        title: titles || `AI Generated: ${channel?.niche || "Video"}`,
        description: script?.substring(0, 200) || "",
        tags: tags,
        privacy: "private",
      });
    } catch {}
  };

  const handleUpload = async () => {
    if (!form.title.trim()) return;
    setUploading(true);
    setError("");
    try {
      const r = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          privacy: form.privacy,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Upload failed");
      setResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
    setUploading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ fontSize: 22, color: "#e0e0e0", marginBottom: 20 }}>YouTube Upload</h2>

      {!oauthStatus?.connected && (
        <div style={{ ...styles.card, borderColor: "#fbbf24", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: "#fbbf24", fontWeight: 600 }}>⚠ YouTube not connected</span>
              <p style={{ color: "#888", fontSize: 12, margin: "4px 0 0" }}>
                Go to Settings → YouTube OAuth to connect your channel first.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {result && (
        <div style={{ ...styles.card, borderColor: "#4ade80", marginBottom: 16 }}>
          <h3 style={{ color: "#4ade80", fontSize: 15, marginBottom: 4 }}>Upload Successful!</h3>
          <p style={{ color: "#ccc", fontSize: 13, marginBottom: 8 }}>{result.youtube_url}</p>
          <p style={{ color: "#888", fontSize: 12 }}>Video ID: {result.youtube_video_id} | Privacy: {result.privacy_status}</p>
        </div>
      )}

      <div style={styles.card}>
        <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 16 }}>Upload Metadata</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <select style={styles.select} value={selectedPackage || ""} onChange={(e) => setSelectedPackage(Number(e.target.value) || null)}>
            <option value="">Auto-fill from package (optional)...</option>
            {packages.map((p) => <option key={p.id} value={p.id}>Package #{p.id}</option>)}
          </select>

          <div>
            <label style={styles.label}>Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Video title (max 100 chars)" maxLength={100} style={styles.input} />
            <span style={{ color: "#666", fontSize: 10 }}>{form.title.length}/100</span>
          </div>

          <div>
            <label style={styles.label}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Video description (max 5000 chars)" rows={3} maxLength={5000} style={{ ...styles.input, resize: "vertical" } as any} />
          </div>

          <div>
            <label style={styles.label}>Tags (comma-separated)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ai, tutorial, faceless" style={styles.input} />
          </div>

          <div>
            <label style={styles.label}>Privacy</label>
            <select value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })} style={styles.select}>
              <option value="private">Private (only you)</option>
              <option value="unlisted">Unlisted (anyone with link)</option>
              <option value="public">Public (everyone — requires Commander override)</option>
            </select>
          </div>

          <button onClick={handleUpload} disabled={uploading || !form.title.trim()} style={{ ...styles.btn, opacity: uploading || !form.title.trim() ? 0.5 : 1 }}>
            {uploading ? "Uploading..." : "Upload to YouTube"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#1e1e2e", borderRadius: 8, padding: "18px 22px", border: "1px solid #333" },
  select: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14 },
  input: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, width: "100%", boxSizing: "border-box" },
  label: { display: "block", color: "#888", fontSize: 12, marginBottom: 4, textTransform: "uppercase" },
  btn: { padding: "14px 24px", background: "#e94560", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  error: { marginBottom: 12, padding: 12, background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.3)", borderRadius: 6, color: "#ef9a9a", fontSize: 13 },
};

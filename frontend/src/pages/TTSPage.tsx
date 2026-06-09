import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { VideoPackage } from "../lib/types";

export default function TTSPage() {
  const [packages, setPackages] = useState<VideoPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("en-US-JennyNeural");
  const [voices, setVoices] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listPackages().then((data) => {
      if (Array.isArray(data)) setPackages(data.filter((p: any) => p.status === "APPROVED"));
    }).catch(() => {});
    loadVoices();
  }, []);

  useEffect(() => {
    if (selectedPackage) loadScript(selectedPackage);
  }, [selectedPackage]);

  const loadVoices = async () => {
    try {
      const r = await fetch("/api/tts/voices");
      const data = await r.json();
      setVoices(data.voices || []);
    } catch {}
  };

  const loadScript = async (id: number) => {
    try {
      const pkg = await api.getPackage(id);
      const scriptSection = pkg.sections?.find((s: any) => s.section_type === "script");
      try {
        const content = JSON.parse(scriptSection?.content || "{}");
        setScript(content.script || "");
      } catch { setScript(scriptSection?.content || ""); }
    } catch {}
  };

  const handleGenerate = async () => {
    if (!script.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, voice, package_id: selectedPackage }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Generation failed");
      setResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
    setGenerating(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ fontSize: 22, color: "#e0e0e0", marginBottom: 20 }}>TTS Narration Generator</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Generate natural-sounding MP3 voiceovers from scripts using Microsoft Edge TTS (free, no API key needed).</p>

      {error && <div style={styles.error}>{error}</div>}

      {result && (
        <div style={{ ...styles.card, borderColor: "#4ade80", marginBottom: 16 }}>
          <h3 style={{ color: "#4ade80", fontSize: 15, marginBottom: 8 }}>Narration Generated</h3>
          <div style={{ fontSize: 13, color: "#ccc" }}>
            <p>MP3: <code style={{ color: "#aaa" }}>{result.mp3_path}</code></p>
            <p>SRT: <code style={{ color: "#aaa" }}>{result.srt_path}</code></p>
            <p>Voice: {result.voice_used} | Size: {(result.file_size_bytes / 1024).toFixed(1)} KB | Words: {result.word_count}</p>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <select style={styles.select} value={selectedPackage || ""} onChange={(e) => setSelectedPackage(Number(e.target.value) || null)}>
            <option value="">Auto-fill script from package (optional)...</option>
            {packages.map((p) => <option key={p.id} value={p.id}>Package #{p.id}</option>)}
          </select>

          <div style={{ display: "flex", gap: 12 }}>
            <select value={voice} onChange={(e) => setVoice(e.target.value)} style={{ ...styles.select, flex: 1 }}>
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.locale}, {v.gender})</option>)}
              {voices.length === 0 && <option value="en-US-JennyNeural">en-US-JennyNeural (US, Female)</option>}
            </select>
            <button onClick={loadVoices} style={styles.smallBtn}>Refresh Voices</button>
          </div>

          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste or type your narration script here..."
            rows={8}
            style={{ ...styles.input, resize: "vertical", minHeight: 160 } as any}
          />
          <div style={{ display: "flex", gap: 8, color: "#666", fontSize: 11 }}>
            <span>Words: {script.trim() ? script.trim().split(/\s+/).length : 0}</span>
            <span>Est. duration: {script.trim() ? Math.ceil(script.trim().split(/\s+/).length / 2.5) : 0}s</span>
          </div>

          <button onClick={handleGenerate} disabled={generating || !script.trim()} style={{ ...styles.btn, opacity: generating || !script.trim() ? 0.5 : 1 }}>
            {generating ? "Generating audio..." : "Generate MP3 Narration"}
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
  btn: { padding: "14px 24px", background: "#e94560", border: "none", borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  smallBtn: { padding: "8px 14px", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 12 },
  error: { marginBottom: 12, padding: 12, background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.3)", borderRadius: 6, color: "#ef9a9a", fontSize: 13 },
};

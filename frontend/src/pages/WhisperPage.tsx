import { useState, useEffect } from "react";

export default function WhisperPage() {
  const [status, setStatus] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [audioPath, setAudioPath] = useState("");

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const r = await fetch("/api/whisper/status");
      setStatus(await r.json());
    } catch {}
  };

  const handleTranscribeUrl = async () => {
    if (!videoUrl.trim()) return;
    setTranscribing(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/whisper/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, language }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Transcription failed");
      setResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
    setTranscribing(false);
  };

  const handleTranscribeFile = async () => {
    if (!audioPath.trim()) return;
    setTranscribing(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/whisper/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_path: audioPath, language }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Transcription failed");
      setResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
    setTranscribing(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2 style={{ fontSize: 22, color: "#e0e0e0", marginBottom: 20 }}>Whisper Transcription</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Transcribe audio from YouTube videos or local files using OpenAI Whisper (local or API).
      </p>

      {status && (
        <div style={{ ...styles.card, marginBottom: 16, borderColor: status.local_whisper_available || status.openai_api_available ? "#4ade80" : "#fbbf24" }}>
          <span style={{ color: "#888", fontSize: 11, textTransform: "uppercase" }}>Available Methods</span>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <span style={{ color: status.local_whisper_available ? "#4ade80" : "#f87171", fontSize: 12 }}>
              {status.local_whisper_available ? "✓" : "✗"} Local Whisper
            </span>
            <span style={{ color: status.openai_api_available ? "#4ade80" : "#f87171", fontSize: 12 }}>
              {status.openai_api_available ? "✓" : "✗"} OpenAI API
            </span>
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={styles.card}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 12 }}>YouTube Video</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              placeholder="YouTube video URL..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              style={styles.input}
            />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={styles.select}>
              <option value="en">English</option>
              <option value="auto">Auto-detect</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="hi">Hindi</option>
              <option value="ja">Japanese</option>
            </select>
            <button onClick={handleTranscribeUrl} disabled={transcribing || !videoUrl.trim()} style={{ ...styles.btn, opacity: transcribing || !videoUrl.trim() ? 0.5 : 1 }}>
              {transcribing ? "Downloading & Transcribing..." : "Transcribe YouTube Video"}
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 12 }}>Local Audio File</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              placeholder="Path to audio file (e.g., data/audio/narration.mp3)"
              value={audioPath}
              onChange={(e) => setAudioPath(e.target.value)}
              style={styles.input}
            />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={styles.select}>
              <option value="en">English</option>
              <option value="auto">Auto-detect</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="hi">Hindi</option>
            </select>
            <button onClick={handleTranscribeFile} disabled={transcribing || !audioPath.trim()} style={{ ...styles.btn, opacity: transcribing || !audioPath.trim() ? 0.5 : 1 }}>
              {transcribing ? "Transcribing..." : "Transcribe Audio File"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div style={{ ...styles.card, marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, color: "#4ade80", margin: 0 }}>Transcription Complete</h3>
            <span style={{ color: "#888", fontSize: 12 }}>
              {result.method_used} | {result.word_count} words | {result.language}
            </span>
          </div>
          <div style={{ background: "#0f0f1a", borderRadius: 6, padding: 16, maxHeight: 400, overflow: "auto" }}>
            {result.segments ? (
              result.segments.map((s: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "4px 0", borderBottom: "1px solid #1a1a2e", fontSize: 13 }}>
                  <span style={{ color: "#e94560", minWidth: 60, textAlign: "right", fontSize: 11, fontFamily: "monospace" }}>
                    {formatTime(s.start)} → {formatTime(s.end)}
                  </span>
                  <span style={{ color: "#ccc", flex: 1 }}>{s.text}</span>
                </div>
              ))
            ) : (
              <pre style={{ color: "#ccc", whiteSpace: "pre-wrap", fontSize: 13 }}>{result.text}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#1e1e2e", borderRadius: 8, padding: "18px 22px", border: "1px solid #333" },
  select: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14 },
  input: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, width: "100%", boxSizing: "border-box" },
  btn: { padding: "12px 20px", background: "#e94560", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  error: { marginBottom: 12, padding: 12, background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.3)", borderRadius: 6, color: "#ef9a9a", fontSize: 13 },
};

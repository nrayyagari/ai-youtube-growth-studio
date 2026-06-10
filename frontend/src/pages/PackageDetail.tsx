import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { storage } from "../lib/storage";
import type { VideoPackage } from "../lib/types";

export default function PackageDetail() {
  const { id } = useParams<{ id: string }>();
  const [pkg, setPkg] = useState<VideoPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    storage.getPackage(id)
      .then((data) => setPkg(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ color: "#888", padding: 40 }}>Loading...</p>;
  if (!pkg) return <p style={{ color: "#888", padding: 40 }}>Not found.</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={styles.h1}>{pkg.topic || `Script ${pkg.id?.slice(0, 8)}`}</h1>
        <Link to="/my-videos" style={styles.back}>← My Scripts</Link>
      </div>

      {pkg.reference_url && (
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
          Reference: <a href={pkg.reference_url} target="_blank" rel="noopener noreferrer" style={{ color: "#8fd3ff" }}>{pkg.reference_url}</a>
        </p>
      )}

      {pkg.sections?.map((s, i) => {
        let content: any = {};
        try { content = typeof s.content === "string" ? JSON.parse(s.content) : s.content; } catch {}
        return (
          <div key={s.id || i} style={styles.block}>
            <div style={styles.blockHeader}>
              <span style={styles.blockTitle}>{sectionLabels[s.section_type] || s.section_type}</span>
              <span style={styles.blockScore}>{s.score}/100</span>
            </div>
            <div style={styles.blockBody}>
              <pre style={{ margin: 0, fontSize: 13, color: "#ccc", whiteSpace: "pre-wrap", maxHeight: 500, overflow: "auto" }}>
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const sectionLabels: Record<string, string> = {
  idea: "Video Idea",
  script: "Narration Script",
  scene_plan: "Scene-by-Scene Plan",
  titles: "Titles & SEO",
};

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, color: "#fff", margin: 0 },
  back: { color: "#e94560", textDecoration: "none", fontSize: 14 },
  block: {
    background: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  blockHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "#16213e",
  },
  blockTitle: { fontWeight: 600, fontSize: 14, color: "#e0e0e0" },
  blockScore: { fontSize: 13, color: "#81c784", fontWeight: 600 },
  blockBody: { padding: 16 },
};

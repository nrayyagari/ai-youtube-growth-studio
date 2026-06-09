import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { VideoPackage } from "../lib/types";

interface ThumbnailImage {
  id: number;
  package_id: number;
  concept_name: string;
  image_path: string;
  prompt_used: string;
  file_size_bytes: number;
  created_at: string;
}

export default function ThumbnailGenerator() {
  const [packages, setPackages] = useState<VideoPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [images, setImages] = useState<ThumbnailImage[]>([]);
  const [generating, setGenerating] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listPackages().then((data) => {
      if (Array.isArray(data)) setPackages(data.filter((p: any) => p.status === "APPROVED"));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedPackage) loadPackage(selectedPackage);
  }, [selectedPackage]);

  const loadPackage = async (id: number) => {
    setConcepts([]);
    setImages([]);
    setError("");
    try {
      const pkg = await api.getPackage(id);
      const thumbSection = pkg.sections?.find((s: any) => s.section_type === "thumbnail");
      if (thumbSection) {
        try {
          const content = JSON.parse(thumbSection.content);
          setConcepts(content.thumbnail_concepts || []);
        } catch {}
      }
      const r = await fetch(`/api/thumbnails/${id}`);
      setImages(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleGenerate = async (index: number) => {
    if (!selectedPackage) return;
    setGenerating(index);
    setError("");
    try {
      const r = await fetch("/api/thumbnails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: selectedPackage, concept_index: index }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Generation failed");
      await loadPackage(selectedPackage);
    } catch (e: any) {
      setError(e.message);
    }
    setGenerating(null);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/thumbnails/${id}`, { method: "DELETE" });
    loadPackage(selectedPackage!);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h2 style={{ fontSize: 22, color: "#e0e0e0", marginBottom: 20 }}>Thumbnail Generator</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Generate actual thumbnail images from AI-generated concepts using Gemini Imagen.
      </p>

      <div style={{ marginBottom: 16 }}>
        <select style={styles.select} value={selectedPackage || ""} onChange={(e) => setSelectedPackage(Number(e.target.value) || null)}>
          <option value="">Select an approved package...</option>
          {packages.map((p) => <option key={p.id} value={p.id}>Package #{p.id}</option>)}
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {concepts.length > 0 && (
        <div style={styles.card}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 12 }}>Thumbnail Concepts ({concepts.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {concepts.map((c: any, i: number) => {
              const existingImage = images.find((img) => img.concept_name === c.concept_name);
              return (
                <div key={i} style={{ ...styles.card, padding: 14, cursor: "default" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ ...styles.badge, background: "#16213e", color: "#e94560" }}>{c.concept_name || `Variant ${i + 1}`}</span>
                      <span style={{ color: "#888", fontSize: 11, marginLeft: 8 }}>{c.emotional_trigger}</span>
                    </div>
                    <span style={{ color: c.click_potential === "high" ? "#4ade80" : "#fbbf24", fontSize: 11, fontWeight: 600 }}>
                      {c.click_potential?.toUpperCase()} CTR
                    </span>
                  </div>
                  {c.text_overlay && <p style={{ color: "#a371f7", fontSize: 13, fontWeight: 600, margin: "4px 0" }}>"{c.text_overlay}"</p>}
                  {c.description && <p style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>{c.description.substring(0, 150)}</p>}
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {(c.color_scheme || "").split(",").map((color: string, ci: number) => (
                      <div key={ci} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: color.trim(), border: "1px solid #444" }} />
                      </div>
                    ))}
                  </div>

                  {existingImage ? (
                    <div>
                      <img src={`/${existingImage.image_path}`} alt={c.concept_name} style={{ width: "100%", borderRadius: 6, marginBottom: 8, maxHeight: 200, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "#4ade80", fontSize: 11 }}>{(existingImage.file_size_bytes / 1024).toFixed(1)} KB</span>
                        <button onClick={() => handleDelete(existingImage.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 11 }}>Delete</button>
                        <button onClick={() => handleGenerate(i)} disabled={generating === i} style={{ background: "none", border: "none", color: "#e94560", cursor: "pointer", fontSize: 11 }}>
                          {generating === i ? "Generating..." : "Regenerate"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => handleGenerate(i)} disabled={generating === i} style={{ ...styles.btn, width: "100%", opacity: generating === i ? 0.5 : 1 }}>
                      {generating === i ? "Generating..." : "Generate Image"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedPackage && concepts.length === 0 && (
        <p style={{ color: "#666", textAlign: "center", padding: 40 }}>
          No thumbnail concepts found. Generate a package first — the ThumbnailAgent produces concept descriptions, then you can render them here.
        </p>
      )}

      {!selectedPackage && (
        <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Select an approved package to view its thumbnail concepts.</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  select: { padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, minWidth: 300 },
  card: { background: "#1e1e2e", borderRadius: 8, padding: "18px 22px", border: "1px solid #333" },
  btn: { padding: "10px 16px", background: "#e94560", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  badge: { padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, display: "inline-block" },
  error: { marginBottom: 12, padding: 12, background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.3)", borderRadius: 6, color: "#ef9a9a", fontSize: 13 },
};

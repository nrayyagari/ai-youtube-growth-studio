import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { api } from "../lib/api";
import type { VideoPackage, ApprovalResult } from "../lib/types";
import GrowthScoreBreakdown from "../components/reports/GrowthScoreBreakdown";

export default function PackageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<VideoPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repurposing, setRepurposing] = useState(false);
  const [repurposeResult, setRepurposeResult] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api.getPackage(Number(id))
      .then(setPkg)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ color: "#888" }}>Loading...</p>;
  if (error) return <p style={{ color: "#ef9a9a" }}>{error}</p>;
  if (!pkg) return <p style={{ color: "#888" }}>Not found.</p>;

  const approval: ApprovalResult = {
    status: pkg.status,
    scores: {},
    failing: [],
    corrections: [],
  };

  if (pkg.sections) {
    pkg.sections.forEach((s) => {
      try {
        const content = JSON.parse(s.content);
        if (s.section_type === "idea" && content.ideas?.[0]) {
          approval.scores.growth_score = content.ideas[0].score?.total || 0;
        }
        if (s.section_type === "script" && content.score) {
          approval.scores.script_score = content.score.script_quality?.score || 0;
          approval.scores.retention = content.score.retention?.score || 0;
          approval.scores.monetization = content.score.monetization?.score || 0;
          approval.scores.factual_accuracy = content.score.factual_accuracy?.score || 0;
        }
        if (s.section_type === "titles" && content) {
          approval.scores.title_score = content.title_score?.score || 0;
        }
        if (s.section_type === "thumbnail" && content.score) {
          approval.scores.thumbnail_score = content.score.thumbnail_quality?.score || 0;
        }
        if (s.section_type === "qa_report" && content.checks) {
          content.checks.forEach((c: any) => {
            if (c.type === "copyright") approval.scores.copyright_safety = c.score || 0;
            if (c.type === "monetization") approval.scores.monetization = c.score || 0;
          });
        }
      } catch {}
    });
  }

  const handleRepurpose = async () => {
    if (!id) return;
    setRepurposing(true);
    setError("");
    try {
      const r = await fetch(`/api/packages/${id}/repurpose`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).detail || "Repurpose failed");
      setRepurposeResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    }
    setRepurposing(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={styles.h1}>Package #{pkg.id}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pkg.status === "APPROVED" && (
            <button onClick={handleRepurpose} disabled={repurposing} style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #a371f7",
              background: "transparent",
              color: "#a371f7",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              opacity: repurposing ? 0.5 : 1,
            }}>
              {repurposing ? "Repurposing..." : "Repurpose as Shorts"}
            </button>
          )}
          <Link to="/generate" style={styles.back}>← Generator</Link>
        </div>
      </div>

      {repurposeResult && (
        <div style={{ marginBottom: 16, padding: 12, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 6 }}>
          <span style={{ color: "#4ade80", fontWeight: 600 }}>Created {repurposeResult.shorts_created} Shorts!</span>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {repurposeResult.shorts?.map((s: any) => (
              <span key={s.package_id} onClick={() => navigate(`/packages/${s.package_id}`)} style={{ padding: "4px 10px", borderRadius: 4, background: "#16213e", color: "#a371f7", cursor: "pointer", fontSize: 12 }}>
                #{s.package_id}: {s.title}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <GrowthScoreBreakdown approval={approval} />
      </div>

      {pkg.sections?.map((s, i) => {
        let content: any = {};
        try { content = JSON.parse(s.content); } catch {}
        const renderer = sectionRenderers[s.section_type] || renderRaw;
        return (
          <div key={s.id || i} style={styles.block}>
            <div style={styles.blockHeader}>
              <span style={styles.blockTitle}>{sectionLabels[s.section_type] || s.section_type}</span>
              <span style={styles.blockScore}>{s.score}/100</span>
            </div>
            <div style={styles.blockBody}>
              {renderer(content)}
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
  music: "Music Suggestions",
  titles: "Titles & SEO",
  thumbnail: "Thumbnail Concepts",
  qa_report: "QA Report",
};

function renderIdea(content: any) {
  const idea = content.ideas?.[0];
  if (!idea) return renderRaw(content);
  return (
    <div>
      <div style={s.field}><span style={s.label}>Topic:</span> {idea.topic}</div>
      <div style={s.field}><span style={s.label}>Title:</span> {idea.title}</div>
      <div style={s.field}><span style={s.label}>Angle:</span> {idea.angle}</div>
      <div style={s.field}><span style={s.label}>Audience:</span> {idea.audience_relevance}</div>
      {idea.score && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#ccc" }}>Growth Score: {idea.score.total}/100</div>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Category</th><th style={s.th}>Score</th><th style={s.th}>Reason</th></tr></thead>
            <tbody>
              {Object.entries(idea.score).filter(([k]) => k !== "total" && k !== "raw_output").map(([key, val]: [string, any]) => (
                <tr key={key}><td style={s.td}>{key.replace(/_/g, " ")}</td><td style={s.td}>{val.score}</td><td style={{ ...s.td, color: "#888" }}>{val.explanation}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderScript(content: any) {
  return (
    <div>
      <div style={{ ...s.field, fontSize: 16, color: "#e94560", fontWeight: 600 }}>Hook: {content.hook}</div>
      <div style={{ ...s.field, marginTop: 12, color: "#aaa" }}>Tone: {content.tone} · Duration: ~{content.estimated_duration_seconds}s</div>
      {content.segments && (
        <div style={{ margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {content.segments.map((seg: any, i: number) => (
            <span key={i} style={{ padding: "4px 10px", background: "#16213e", borderRadius: 4, fontSize: 12, color: "#aaa" }}>
              {seg.name} ({seg.duration_estimate}s)
            </span>
          ))}
        </div>
      )}
      <div style={{ ...s.field, marginTop: 16, color: "#ccc" }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>CTA: {content.cta}</div>
      </div>
      {content.on_screen_text?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#888" }}>On-Screen Text:</div>
          {content.on_screen_text.map((t: string, i: number) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #222", fontSize: 13, color: "#aaa" }}>→ {t}</div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 20, padding: "16px", background: "#0f0f1a", borderRadius: 6, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "#ddd", maxHeight: 500, overflow: "auto" }}>
        {content.script}
      </div>
    </div>
  );
}

function renderScenePlan(content: any) {
  const scenes = content.scenes || [];
  return (
    <div>
      <div style={s.field}><span style={s.label}>Style:</span> {content.visual_style_summary}</div>
      <div style={s.field}><span style={s.label}>Template:</span> {content.template} · {content.aspect_ratio}</div>
      {content.color_palette && (
        <div style={{ margin: "8px 0", display: "flex", gap: 8 }}>
          {content.color_palette.map((c: string, i: number) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#888" }}>
              <span style={{ width: 14, height: 14, background: c, borderRadius: 3, display: "inline-block" }} />{c}
            </span>
          ))}
        </div>
      )}
      <table style={{ ...s.table, marginTop: 16 }}>
        <thead><tr><th style={s.th}>#</th><th style={s.th}>Duration</th><th style={s.th}>Visual</th><th style={s.th}>Text</th><th style={s.th}>Style</th></tr></thead>
        <tbody>
          {scenes.map((sc: any) => (
            <tr key={sc.scene_number}>
              <td style={s.td}>{sc.scene_number}</td>
              <td style={s.td}>{sc.duration_seconds}s</td>
              <td style={{ ...s.td, maxWidth: 300 }}>{sc.visual_description}</td>
              <td style={s.td}>{sc.on_screen_text}</td>
              <td style={s.td}>{sc.style} · {sc.transition}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderMusic(content: any) {
  const suggestions = content.music_suggestions || [];
  return (
    <div>
      <div style={s.field}><span style={s.label}>Direction:</span> {content.overall_music_direction}</div>
      {suggestions.map((m: any, i: number) => (
        <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #222" }}>
          <div style={{ fontWeight: 600, color: "#ccc" }}>{m.scene_range}: {m.mood} {m.genre} ({m.tempo})</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Source: {m.source}</div>
          <div style={{ fontSize: 12, color: "#888" }}>Search: {m.search_keywords?.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}

function renderTitles(content: any) {
  const titles = content.titles || [];
  return (
    <div>
      <div style={{ ...s.field, fontSize: 16, color: "#e94560", fontWeight: 600 }}>Recommended: {content.recommended_title}</div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: "#ccc" }}>Title Options:</div>
        {titles.map((t: any, i: number) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#ddd" }}>{t.title}</span>
            <span style={{ fontSize: 12, color: "#888" }}>{t.strategy} · CTR: {t.ctr_estimate}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: "#888" }}>Description:</div>
        <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{content.description}</div>
      </div>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span style={s.tag}>Tags: {content.tags?.join(", ")}</span>
        <span style={s.tag}>Hashtags: {content.hashtags?.join(" ")}</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, color: "#888", marginBottom: 4 }}>Pinned Comment:</div>
        <div style={{ color: "#aaa", fontSize: 13 }}>{content.pinned_comment}</div>
      </div>
    </div>
  );
}

function renderThumbnail(content: any) {
  const concepts = content.thumbnail_concepts || [];
  return (
    <div>
      <div style={s.field}><span style={s.label}>Recommended:</span> {content.recommended_concept}</div>
      {concepts.map((c: any, i: number) => (
        <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #222" }}>
          <div style={{ fontWeight: 600, color: "#ccc" }}>{c.concept_name} — {c.click_potential} CTR</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 6, lineHeight: 1.6 }}>{c.description}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
            <span style={s.tag}>Text: {c.text_overlay}</span>
            <span style={{ ...s.tag, marginLeft: 8 }}>Color: {c.color_scheme}</span>
            <span style={{ ...s.tag, marginLeft: 8 }}>Trigger: {c.emotional_trigger}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderQA(content: any) {
  const checks = content.checks || [];
  return (
    <div>
      {checks.map((c: any, i: number) => (
        <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #222", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{
            padding: "4px 10px",
            borderRadius: 4,
            background: c.status === "PASS" ? "#1b5e20" : c.status === "WARN" ? "#5c3d00" : "#5c1a1a",
            color: c.status === "PASS" ? "#81c784" : c.status === "WARN" ? "#ffb74d" : "#ef9a9a",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}>{c.status}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "#ccc", textTransform: "capitalize" }}>{c.type.replace(/_/g, " ")} — {c.score}/100</div>
            <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>{c.details}</div>
            {c.issues?.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {c.issues.map((issue: string, j: number) => (
                  <div key={j} style={{ color: "#ef9a9a", fontSize: 12 }}>⚠ {issue}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {content.corrections_needed?.length > 0 && (
        <div style={{ marginTop: 16, padding: "12px", background: "rgba(233,69,96,0.1)", borderRadius: 6 }}>
          <div style={{ fontWeight: 600, color: "#ef9a9a", marginBottom: 8 }}>Corrections Needed:</div>
          {content.corrections_needed.map((c: string, i: number) => (
            <div key={i} style={{ color: "#ef9a9a", fontSize: 13 }}>→ {c}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderRaw(content: any) {
  return <pre style={{ padding: 16, margin: 0, fontSize: 12, color: "#aaa", whiteSpace: "pre-wrap", maxHeight: 500, overflow: "auto" }}>
    {JSON.stringify(content, null, 2)}
  </pre>;
}

const sectionRenderers: Record<string, (c: any) => JSX.Element> = {
  idea: renderIdea,
  script: renderScript,
  scene_plan: renderScenePlan,
  music: renderMusic,
  titles: renderTitles,
  thumbnail: renderThumbnail,
  qa_report: renderQA,
};

const s: Record<string, React.CSSProperties> = {
  field: { marginBottom: 8, fontSize: 14, lineHeight: 1.6, color: "#ccc" },
  label: { color: "#888", fontWeight: 600, marginRight: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "6px 8px", color: "#888", fontSize: 11, borderBottom: "1px solid #333", textTransform: "uppercase" },
  td: { padding: "8px", borderBottom: "1px solid #222", color: "#ccc", verticalAlign: "top" },
  tag: { padding: "3px 8px", background: "#16213e", borderRadius: 4, fontSize: 11, color: "#888" },
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

import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { storage } from "../lib/storage";
import type { PackageSection, VideoPackage } from "../lib/types";

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

  const sections = pkg.sections || [];
  const ideaSection = sections.find((section) => section.section_type === "idea");
  const scriptSection = sections.find((section) => section.section_type === "script");
  const visualSection = sections.find((section) => section.section_type === "visual");
  const titleSection = sections.find((section) => section.section_type === "titles");
  const thumbnailSection = sections.find((section) => section.section_type === "thumbnail");
  const qaSection = sections.find((section) => section.section_type === "qa_report");

  const idea = parseSectionContent(ideaSection);
  const script = parseSectionContent(scriptSection);
  const visuals = parseSectionContent(visualSection);
  const titles = parseSectionContent(titleSection);
  const thumbnail = parseSectionContent(thumbnailSection);
  const qa = parseSectionContent(qaSection);

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <p style={styles.kicker}>Script Package</p>
          <h1 style={styles.h1}>{pkg.topic || `Script ${pkg.id?.slice(0, 8)}`}</h1>
          <p style={styles.meta}>
            Created {pkg.created_at ? new Date(pkg.created_at).toLocaleString() : "recently"} · Status {pkg.approval?.status || "Unknown"}
          </p>
        </div>
        <Link to="/my-videos" style={styles.back}>← My Scripts</Link>
      </div>

      {pkg.reference_url && (
        <div style={styles.referenceCard}>
          <p style={styles.referenceLabel}>Reference Video</p>
          <a href={pkg.reference_url} target="_blank" rel="noopener noreferrer" style={styles.referenceLink}>
            {pkg.reference_url}
          </a>
        </div>
      )}

      {pkg.approval && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.cardTitle}>Approval Snapshot</h2>
            <span style={pkg.approval.status === "APPROVED" ? styles.statusApproved : styles.statusNeedsWork}>
              {pkg.approval.status}
            </span>
          </div>
          <div style={styles.scoreGrid}>
            {Object.entries(pkg.approval.scores || {}).slice(0, 8).map(([label, score]) => (
              <div key={label} style={styles.scoreCard}>
                <p style={styles.scoreLabel}>{humanizeKey(label)}</p>
                <p style={styles.scoreValue}>{score}</p>
              </div>
            ))}
          </div>
          {!!pkg.approval.failing?.length && (
            <div style={styles.warningBox}>
              <p style={styles.warningTitle}>Needs improvement</p>
              {pkg.approval.failing.map((item) => (
                <p key={item.category} style={styles.warningText}>
                  {humanizeKey(item.category)} scored {item.score}, target is {item.required}.
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {idea && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.cardTitle}>Core Idea</h2>
            <SectionScore section={ideaSection} />
          </div>
          {Array.isArray(idea.ideas) && idea.ideas.length > 0 ? (
            <div style={styles.ideaList}>
              {idea.ideas.map((entry: any, index: number) => (
                <article key={`${entry.title || entry.topic}-${index}`} style={styles.ideaCard}>
                  <p style={styles.ideaHeading}>{entry.title || entry.topic || `Idea ${index + 1}`}</p>
                  {entry.angle && <p style={styles.blockText}><strong>Angle:</strong> {entry.angle}</p>}
                  {entry.audience_relevance && <p style={styles.blockText}><strong>Audience fit:</strong> {entry.audience_relevance}</p>}
                </article>
              ))}
            </div>
          ) : (
            <pre style={styles.pre}>{JSON.stringify(idea, null, 2)}</pre>
          )}
        </section>
      )}

      {script && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.cardTitle}>Narration Script</h2>
            <SectionScore section={scriptSection} />
          </div>
          {script.hook && (
            <div style={styles.highlightBox}>
              <p style={styles.highlightLabel}>Hook</p>
              <p style={styles.highlightText}>{script.hook}</p>
            </div>
          )}
          {script.script ? <article style={styles.scriptBody}>{script.script}</article> : <pre style={styles.pre}>{JSON.stringify(script, null, 2)}</pre>}
        </section>
      )}

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.cardTitle}>Titles</h2>
            <SectionScore section={titleSection} />
          </div>
          {Array.isArray(titles?.titles) && titles.titles.length > 0 ? (
            <ol style={styles.rankList}>
              {titles.titles.map((entry: any, index: number) => (
                <li key={`${entry.title}-${index}`} style={styles.rankItem}>
                  <span>{entry.title}</span>
                  {entry.predicted_ctr != null && <span style={styles.rankMetric}>{entry.predicted_ctr}% CTR</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p style={styles.emptyText}>No title options generated.</p>
          )}
          {titles?.recommended_title && (
            <p style={styles.recommended}>Recommended: {titles.recommended_title}</p>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.cardTitle}>Thumbnail Angle</h2>
            <SectionScore section={thumbnailSection} />
          </div>
          {Array.isArray(thumbnail?.thumbnail_concepts) && thumbnail.thumbnail_concepts.length > 0 ? (
            thumbnail.thumbnail_concepts.map((concept: any, index: number) => (
              <div key={`${concept.concept_name}-${index}`} style={styles.thumbConcept}>
                <p style={styles.ideaHeading}>{concept.concept_name || "Thumbnail concept"}</p>
                {concept.description && <p style={styles.blockText}>{concept.description}</p>}
                {concept.text_overlay && <p style={styles.blockText}><strong>Text overlay:</strong> {concept.text_overlay}</p>}
                {concept.color_scheme && <p style={styles.blockText}><strong>Color:</strong> {concept.color_scheme}</p>}
              </div>
            ))
          ) : (
            <p style={styles.emptyText}>No thumbnail concept generated.</p>
          )}
        </section>
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.cardTitle}>Scene Plan</h2>
            <SectionScore section={visualSection} />
          </div>
          {Array.isArray(visuals?.scenes) && visuals.scenes.length > 0 ? (
            <div style={styles.sceneList}>
              {visuals.scenes.map((scene: any, index: number) => (
                <div key={`${scene.scene_number || index}`} style={styles.sceneRow}>
                  <div style={styles.sceneBadge}>Scene {scene.scene_number || index + 1}</div>
                  <div>
                    <p style={styles.blockText}>{scene.description || "No scene description"}</p>
                    {scene.duration && <p style={styles.sceneMeta}>{scene.duration}s</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>No scene plan generated.</p>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.cardTitle}>Quality Checks</h2>
            <SectionScore section={qaSection} />
          </div>
          {Array.isArray(qa?.checks) && qa.checks.length > 0 ? (
            <div style={styles.checkList}>
              {qa.checks.map((check: any, index: number) => (
                <div key={`${check.type}-${index}`} style={styles.checkRow}>
                  <div>
                    <p style={styles.checkTitle}>{humanizeKey(check.type || "check")}</p>
                    {check.details && <p style={styles.sceneMeta}>{check.details}</p>}
                  </div>
                  <span style={styles.checkScore}>{check.score ?? "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>No QA report available.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionScore({ section }: { section?: PackageSection }) {
  if (!section || !section.score) return null;
  return <span style={styles.scoreBadge}>{section.score}/100</span>;
}

function parseSectionContent(section?: PackageSection) {
  if (!section) return null;
  const raw = section.content;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
  return raw;
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: 18 },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" },
  kicker: { margin: 0, color: "#8fd3ff", fontSize: 12, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 },
  h1: { fontSize: 30, color: "#fff", margin: "8px 0 10px" },
  meta: { color: "#8f93a7", margin: 0, fontSize: 13 },
  back: { color: "#e94560", textDecoration: "none", fontSize: 14, fontWeight: 600 },
  referenceCard: { padding: 16, borderRadius: 12, border: "1px solid #334155", background: "#111827" },
  referenceLabel: { margin: "0 0 8px", color: "#cbd5e1", fontSize: 12, textTransform: "uppercase", fontWeight: 700 },
  referenceLink: { color: "#8fd3ff", textDecoration: "none", overflowWrap: "anywhere" },
  card: { background: "#181827", border: "1px solid #343448", borderRadius: 14, padding: 20 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  cardTitle: { margin: 0, color: "#fff", fontSize: 18 },
  statusApproved: { padding: "6px 10px", borderRadius: 999, background: "#16311f", color: "#8fe4a6", fontSize: 12, fontWeight: 700 },
  statusNeedsWork: { padding: "6px 10px", borderRadius: 999, background: "#3a1b21", color: "#ff9aa8", fontSize: 12, fontWeight: 700 },
  scoreGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 },
  scoreCard: { padding: 14, borderRadius: 10, background: "#11111c", border: "1px solid #2b2b3d" },
  scoreLabel: { margin: 0, color: "#8f93a7", fontSize: 12 },
  scoreValue: { margin: "8px 0 0", color: "#fff", fontSize: 22, fontWeight: 700 },
  warningBox: { marginTop: 16, padding: 14, borderRadius: 10, background: "#2b1620", border: "1px solid #5a2333" },
  warningTitle: { margin: "0 0 6px", color: "#ffb4be", fontWeight: 700 },
  warningText: { margin: 0, color: "#f4c5cf", fontSize: 13, lineHeight: 1.6 },
  ideaList: { display: "grid", gap: 12 },
  ideaCard: { padding: 16, borderRadius: 12, background: "#11111c", border: "1px solid #2b2b3d" },
  ideaHeading: { margin: "0 0 8px", color: "#fff", fontSize: 17, fontWeight: 700 },
  blockText: { margin: "0 0 8px", color: "#c7cada", lineHeight: 1.65, fontSize: 14 },
  highlightBox: { padding: 14, borderRadius: 12, background: "#111827", border: "1px solid #23324d", marginBottom: 14 },
  highlightLabel: { margin: "0 0 8px", color: "#8fd3ff", fontSize: 12, textTransform: "uppercase", fontWeight: 700 },
  highlightText: { margin: 0, color: "#eef2ff", fontSize: 16, lineHeight: 1.6 },
  scriptBody: { whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#e6e7ef", fontSize: 15, background: "#10101a", border: "1px solid #2a2a3d", borderRadius: 12, padding: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 },
  rankList: { margin: 0, paddingLeft: 18, display: "grid", gap: 10, color: "#e6e7ef" },
  rankItem: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  rankMetric: { color: "#8fd3ff", fontSize: 12, whiteSpace: "nowrap" },
  recommended: { marginTop: 12, color: "#8fe4a6", fontWeight: 600, fontSize: 13 },
  thumbConcept: { padding: 14, borderRadius: 12, background: "#11111c", border: "1px solid #2b2b3d", marginBottom: 10 },
  sceneList: { display: "grid", gap: 12 },
  sceneRow: { display: "grid", gridTemplateColumns: "90px 1fr", gap: 14, alignItems: "flex-start", paddingBottom: 10, borderBottom: "1px solid #252538" },
  sceneBadge: { display: "inline-flex", justifyContent: "center", alignItems: "center", padding: "8px 10px", borderRadius: 999, background: "#111827", color: "#cbd5e1", fontSize: 12, fontWeight: 700 },
  sceneMeta: { margin: 0, color: "#8f93a7", fontSize: 12 },
  checkList: { display: "grid", gap: 10 },
  checkRow: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 0", borderTop: "1px solid #252538" },
  checkTitle: { margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 },
  checkScore: { display: "inline-flex", justifyContent: "center", minWidth: 58, padding: "6px 10px", borderRadius: 999, background: "#111827", color: "#8fd3ff", fontWeight: 700, fontSize: 12 },
  scoreBadge: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: "#111827", color: "#8fd3ff", fontWeight: 700, fontSize: 12 },
  emptyText: { margin: 0, color: "#8f93a7", fontSize: 13 },
  pre: { margin: 0, fontSize: 13, color: "#ccc", whiteSpace: "pre-wrap", maxHeight: 500, overflow: "auto" },
};

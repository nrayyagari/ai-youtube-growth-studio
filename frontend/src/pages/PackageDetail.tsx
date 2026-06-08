import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { VideoPackage, ApprovalResult } from "../lib/types";
import GrowthScoreBreakdown from "../components/reports/GrowthScoreBreakdown";

export default function PackageDetail() {
  const { id } = useParams<{ id: string }>();
  const [pkg, setPkg] = useState<VideoPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={styles.h1}>Package #{pkg.id}</h1>
        <Link to="/generate" style={styles.back}>← Generator</Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <GrowthScoreBreakdown approval={approval} />
      </div>

      {pkg.sections?.map((s) => {
        let content: any = {};
        try { content = JSON.parse(s.content); } catch {}
        return (
          <SectionBlock key={s.id} type={s.section_type} content={content} score={s.score} />
        );
      })}
    </div>
  );
}

function SectionBlock({ type, content, score }: { type: string; content: any; score: number }) {
  const labels: Record<string, string> = {
    idea: "Idea",
    script: "Script",
    scene_plan: "Scene Plan",
    music: "Music",
    titles: "Titles & SEO",
    thumbnail: "Thumbnail",
    qa_report: "QA Report",
  };

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockTitle}>{labels[type] || type}</span>
        <span style={styles.blockScore}>{score}/100</span>
      </div>
      <pre style={styles.pre}>{JSON.stringify(content, null, 2)}</pre>
    </div>
  );
}

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
  pre: {
    padding: "16px",
    margin: 0,
    fontSize: 12,
    color: "#aaa",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: 500,
    overflow: "auto",
  },
};

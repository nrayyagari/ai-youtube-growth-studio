import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.brand}>Growth Studio</div>
        <div style={styles.navLinks}>
          <Link to="/pricing" style={styles.navLink}>Pricing</Link>
          {isAuthenticated ? (
            <Link to="/dashboard" style={styles.primarySmall}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" style={styles.navLink}>Log in</Link>
              <Link to="/dashboard" style={styles.primarySmall}>Open app</Link>
            </>
          )}
        </div>
      </nav>

      <section style={styles.hero}>
        <div style={styles.copy}>
          <p style={styles.kicker}>AI YouTube planning for faceless channels</p>
          <h1 style={styles.h1}>Plan videos that can actually grow before you make them.</h1>
          <p style={styles.sub}>
            Generate ideas, scripts, visuals, music direction, SEO, thumbnails, QA checks, and growth scores in one local-first studio.
          </p>
          <div style={styles.actions}>
            <Link to="/signup" style={styles.primary}>Start free</Link>
            <Link to="/dashboard" style={styles.secondary}>Try local demo</Link>
          </div>
        </div>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>Pipeline</div>
          {["Idea score", "Script", "Visual plan", "Thumbnail", "QA gate"].map((item, index) => (
            <div key={item} style={styles.step}>
              <span style={styles.stepNum}>{index + 1}</span>
              <span>{item}</span>
              <strong style={styles.score}>{index === 0 ? "88" : index === 4 ? "PASS" : "Ready"}</strong>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.band}>
        {[
          ["3 free packages", "Enough to validate the workflow before upgrading."],
          ["Free-tier AI routing", "Gemini, Groq, and Cerebras fallback stay cost-conscious."],
          ["Owned-channel ready", "Use your own analytics to improve future recommendations."],
        ].map(([title, body]) => (
          <article key={title} style={styles.feature}>
            <h2 style={styles.h2}>{title}</h2>
            <p style={styles.featureText}>{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0f0f1a", color: "#f4f4f5" },
  nav: { height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 36px", borderBottom: "1px solid #272737" },
  brand: { fontSize: 18, fontWeight: 800 },
  navLinks: { display: "flex", gap: 18, alignItems: "center" },
  navLink: { color: "#c8c8d2", textDecoration: "none", fontSize: 14 },
  primarySmall: { color: "#fff", background: "#e94560", padding: "9px 14px", borderRadius: 6, textDecoration: "none", fontSize: 14, fontWeight: 700 },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(340px, 0.75fr)", gap: 40, alignItems: "center", padding: "72px 48px 52px", maxWidth: 1180, margin: "0 auto" },
  copy: { maxWidth: 680 },
  kicker: { color: "#8fd3ff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0, marginBottom: 14 },
  h1: { fontSize: 54, lineHeight: 1.05, margin: "0 0 20px", color: "#fff", letterSpacing: 0 },
  sub: { color: "#c8c8d2", fontSize: 18, lineHeight: 1.65, marginBottom: 28 },
  actions: { display: "flex", gap: 14, flexWrap: "wrap" },
  primary: { color: "#fff", background: "#e94560", padding: "13px 18px", borderRadius: 6, textDecoration: "none", fontWeight: 800 },
  secondary: { color: "#f4f4f5", border: "1px solid #55576b", padding: "12px 18px", borderRadius: 6, textDecoration: "none", fontWeight: 700 },
  panel: { background: "#181827", border: "1px solid #343448", borderRadius: 8, padding: 20 },
  panelHeader: { color: "#fff", fontWeight: 800, marginBottom: 14 },
  step: { display: "grid", gridTemplateColumns: "32px 1fr auto", alignItems: "center", gap: 12, padding: "13px 0", borderTop: "1px solid #2b2b3d", color: "#dedee8" },
  stepNum: { width: 26, height: 26, borderRadius: 13, background: "#25324a", display: "grid", placeItems: "center", color: "#8fd3ff", fontSize: 12, fontWeight: 800 },
  score: { color: "#81c784", fontSize: 13 },
  band: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, maxWidth: 1180, margin: "0 auto", padding: "0 48px 64px" },
  feature: { borderTop: "1px solid #343448", paddingTop: 20 },
  h2: { fontSize: 18, margin: "0 0 8px", color: "#fff" },
  featureText: { margin: 0, color: "#aaaabb", lineHeight: 1.55 },
};

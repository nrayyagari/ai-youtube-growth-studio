import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.brand}>Growth Studio</div>
        <div style={styles.navLinks}>
          {isAuthenticated ? (
            <Link to="/generate" style={styles.primarySmall}>Generate</Link>
          ) : (
            <Link to="/login" style={styles.navLink}>Sign in</Link>
          )}
        </div>
      </nav>

      <section style={styles.hero}>
        <p style={styles.kicker}>Your AI YouTube co-pilot</p>
        <h1 style={styles.h1}>Scripts that grow your channel — before you even record.</h1>
        <p style={styles.sub}>
          Generate AI-optimized scripts, titles, scene plans, and SEO — tailored to what actually works. 
          Bring your own API keys. Your data stays in your browser.
        </p>
        <div style={styles.actions}>
          <Link to={isAuthenticated ? "/generate" : "/login"} style={styles.primary}>{isAuthenticated ? "Open your workspace →" : "Sign in to start →"}</Link>
        </div>
      </section>

      <section style={styles.band}>
        {[
          ["AI-powered scripts", "5 AI providers compete to write the best script for your topic."],
          ["Reference-based style", "Paste a YouTube URL to match its pacing, tone, and structure."],
          ["Your keys, your data", "Bring your own API keys. Zero data stored on our server."],
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
  hero: { textAlign: "center", padding: "100px 48px 60px", maxWidth: 720, margin: "0 auto" },
  kicker: { color: "#8fd3ff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 14 },
  h1: { fontSize: 48, lineHeight: 1.1, margin: "0 0 20px", color: "#fff" },
  sub: { color: "#c8c8d2", fontSize: 18, lineHeight: 1.65, marginBottom: 32 },
  actions: { display: "flex", gap: 14, justifyContent: "center" },
  primary: { color: "#fff", background: "#e94560", padding: "16px 28px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 16 },
  band: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, maxWidth: 1080, margin: "0 auto", padding: "0 48px 80px" },
  feature: { borderTop: "1px solid #343448", paddingTop: 20 },
  h2: { fontSize: 18, margin: "0 0 8px", color: "#fff" },
  featureText: { margin: 0, color: "#aaaabb", lineHeight: 1.55 },
};

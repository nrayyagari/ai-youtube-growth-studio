import { Link } from "react-router-dom";

export default function AuthRedirect({ mode }: { mode: "login" | "signup" }) {
  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <h1 style={styles.h1}>{mode === "login" ? "Log in" : "Create account"}</h1>
        <p style={styles.text}>
          Clerk is not connected in local mode yet. When Clerk keys are configured, this route can hand off to Clerk sign-in.
        </p>
        <Link to="/dashboard" style={styles.button}>Continue to local app</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f1a", color: "#f4f4f5", padding: 24 },
  panel: { width: "100%", maxWidth: 420, border: "1px solid #343448", borderRadius: 8, background: "#181827", padding: 28 },
  h1: { margin: "0 0 12px", color: "#fff" },
  text: { color: "#c8c8d2", lineHeight: 1.6, marginBottom: 22 },
  button: { display: "inline-block", color: "#fff", background: "#e94560", padding: "11px 14px", borderRadius: 6, textDecoration: "none", fontWeight: 800 },
};

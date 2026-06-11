import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { handleDriveCallback } from "../lib/drive_sync";

export default function DriveCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const ok = handleDriveCallback();
    setStatus(ok ? "success" : "error");
    if (ok) {
      window.setTimeout(() => navigate("/settings", { replace: true }), 1200);
    }
  }, [navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {status === "loading" && <p style={styles.text}>Connecting your Google Drive...</p>}
        {status === "success" && (
          <>
            <h1 style={styles.title}>Drive Connected</h1>
            <p style={styles.text}>Your backup token is stored only in this browser. Redirecting to Settings...</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 style={styles.title}>Drive Connection Failed</h1>
            <p style={styles.text}>The authorization response was missing or expired. Try connecting Google Drive again from Settings.</p>
            <Link to="/settings" style={styles.link}>Back to Settings</Link>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f1a", padding: 24 },
  card: { width: "100%", maxWidth: 460, background: "#181827", border: "1px solid #343448", borderRadius: 14, padding: 32, textAlign: "center", color: "#f4f4f5" },
  title: { margin: "0 0 12px", fontSize: 26, color: "#fff" },
  text: { margin: 0, color: "#b8b8c9", lineHeight: 1.6, fontSize: 14 },
  link: { display: "inline-block", marginTop: 18, color: "#8fd3ff", textDecoration: "none", fontWeight: 600 },
};

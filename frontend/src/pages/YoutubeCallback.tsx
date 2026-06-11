import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { storage } from "../lib/storage";

export default function YoutubeCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting your YouTube account...");

  useEffect(() => {
    const finishAuth = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`YouTube authorization failed: ${error}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("The YouTube callback did not include an authorization code.");
        return;
      }

      try {
        const oauth = await storage.getYoutubeOAuthConfig();
        if (!oauth.client_id || !oauth.client_secret) {
          throw new Error("Missing YouTube OAuth client credentials in browser storage.");
        }

        const redirectUri = `${window.location.origin}/youtube/callback`;
        const tokens = await api.exchangeYoutubeCode(oauth.client_id, oauth.client_secret, code, redirectUri);
        await storage.setYoutubeTokens({
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
        });
        setStatus("success");
        setMessage("YouTube connected. Redirecting to Analytics...");
        window.setTimeout(() => navigate("/analytics", { replace: true }), 1200);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "YouTube connection failed.");
      }
    };

    void finishAuth();
  }, [navigate, searchParams]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          {status === "success" ? "YouTube Connected" : status === "error" ? "YouTube Connection Failed" : "Authorizing YouTube"}
        </h1>
        <p style={styles.text}>{message}</p>
        {status === "error" && (
          <Link to="/settings" style={styles.link}>Back to Settings</Link>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f1a", padding: 24 },
  card: { width: "100%", maxWidth: 480, background: "#181827", border: "1px solid #343448", borderRadius: 14, padding: 32, textAlign: "center", color: "#f4f4f5" },
  title: { margin: "0 0 12px", fontSize: 26, color: "#fff" },
  text: { margin: 0, color: "#b8b8c9", lineHeight: 1.6, fontSize: 14 },
  link: { display: "inline-block", marginTop: 18, color: "#8fd3ff", textDecoration: "none", fontWeight: 600 },
};

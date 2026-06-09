import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

declare global {
  interface Window {
    Clerk?: {
      openSignIn: (opts?: Record<string, unknown>) => void;
      openSignUp: (opts?: Record<string, unknown>) => void;
      addListener: (event: { event: string }, handler: () => void) => void;
      load: (opts?: Record<string, unknown>) => Promise<void>;
      isReady: () => boolean;
      user: { id: string } | null;
    };
  }
}

export default function AuthRedirect({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ready" | "no-clerk">("loading");

  useEffect(() => {
    const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

    if (!clerkKey) {
      setState("no-clerk");
      return;
    }

    if (window.Clerk?.isReady()) {
      setState("ready");
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.clerk.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js";
    script.async = true;
    script.onload = async () => {
      try {
        if (window.Clerk) {
          await window.Clerk.load({ publishableKey: clerkKey });

          window.Clerk.addListener({ event: "session" }, () => {
            if (window.Clerk?.user) {
              const userId = window.Clerk.user.id;
              document.cookie = `__clerk_user_id=${userId};path=/;max-age=86400`;
              fetch("/api/auth/webhook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "user.created", data: { id: userId } }),
              }).catch(() => {});
            }
            navigate("/dashboard", { replace: true });
          });

          setState("ready");
        }
      } catch {
        setState("no-clerk");
      }
    };
    script.onerror = () => setState("no-clerk");
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [navigate, mode]);

  useEffect(() => {
    if (state === "ready" && window.Clerk) {
      if (mode === "login") {
        window.Clerk.openSignIn();
      } else {
        window.Clerk.openSignUp();
      }
    }
  }, [state, mode]);

  if (state === "loading") {
    return (
      <div style={styles.page}>
        <div style={styles.panel}>
          <p style={styles.loading}>Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <h1 style={styles.h1}>{mode === "login" ? "Log in" : "Create account"}</h1>
        <p style={styles.text}>
          {state === "no-clerk"
            ? "Clerk is not configured. When Clerk keys are set, authentication will be handled automatically."
            : "Redirecting to Clerk..."}
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
  loading: { color: "#aaa", textAlign: "center" },
  button: { display: "inline-block", color: "#fff", background: "#e94560", padding: "11px 14px", borderRadius: 6, textDecoration: "none", fontWeight: 800 },
};

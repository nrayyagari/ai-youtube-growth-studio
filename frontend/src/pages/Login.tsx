import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/generate");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <h1 style={styles.h1}>Log in</h1>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={styles.input}
          />
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={styles.input}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p style={styles.footer}>
          Don't have an account? <Link to="/signup" style={styles.link}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f1a", color: "#f4f4f5", padding: 24 },
  panel: { width: "100%", maxWidth: 400, border: "1px solid #343448", borderRadius: 12, background: "#181827", padding: 32 },
  h1: { margin: "0 0 24px", color: "#fff", fontSize: 24 },
  label: { display: "block", color: "#bbb", fontSize: 13, fontWeight: 600, marginBottom: 6, marginTop: 16 },
  input: { display: "block", width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #444", background: "#1e1e2e", color: "#eee", fontSize: 14, boxSizing: "border-box" },
  button: { display: "block", width: "100%", marginTop: 24, padding: "12px", borderRadius: 6, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 15 },
  error: { color: "#f87171", fontSize: 13, marginTop: 12 },
  footer: { marginTop: 20, textAlign: "center", color: "#888", fontSize: 14 },
  link: { color: "#e94560", textDecoration: "none" },
};

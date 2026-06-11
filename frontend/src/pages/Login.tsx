import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendOtp(email);
      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      navigate("/workspace");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <h1 style={styles.h1}>{step === "email" ? "Sign in" : "Check your email"}</h1>
        {step === "email" ? (
          <form onSubmit={handleSendOtp}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>
              We sent a code to <strong style={{ color: "#ddd" }}>{email}</strong>
            </p>
            <label style={styles.label}>One-time code</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              required
              maxLength={6}
              style={styles.input}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }} style={styles.backBtn}>
              ← Back
            </button>
          </form>
        )}
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
  backBtn: { display: "block", width: "100%", marginTop: 8, padding: "12px", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 14 },
  error: { color: "#f87171", fontSize: 13, marginTop: 12 },
};

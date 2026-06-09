import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PaymentCheckout from "../components/checkout/PaymentCheckout";

const tiers = [
  { name: "Free", price: "$0", key: "free", points: ["3 packages/month", "1 channel", "Core 7-agent pipeline"] },
  { name: "Pro", price: "$19", key: "pro", points: ["Unlimited packages", "3 channels", "Analytics and advanced agents"] },
  { name: "Agency", price: "$49", key: "agency", points: ["Unlimited packages", "20 channels", "Batch generation and competitor analysis"] },
];

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);

  const handleCheckout = async (tier: string) => {
    if (tier === "free") {
      navigate("/signup");
      return;
    }
    setCheckoutTier(tier);
  };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <Link to="/" style={styles.brand}>Growth Studio</Link>
        <div style={styles.navLinks}>
          {isAuthenticated ? (
            <Link to="/generate" style={styles.primarySmall}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" style={styles.navLink}>Log in</Link>
              <Link to="/signup" style={styles.primarySmall}>Sign up free</Link>
            </>
          )}
        </div>
      </nav>

      <h1 style={styles.h1}>Pricing</h1>
      <p style={styles.sub}>Start with the local-first workflow, then unlock higher limits when you turn it into a SaaS.</p>
      {user && (
        <div style={styles.usage}>
          Current tier: <strong>{user.subscription_tier}</strong> · Packages this month: {user.usage?.packages_this_month.used ?? 0}/{user.usage?.packages_this_month.limit ?? "unlimited"}
        </div>
      )}
      <div style={styles.grid}>
        {tiers.map((tier) => (
          <article key={tier.key} style={styles.card}>
            <h2 style={styles.h2}>{tier.name}</h2>
            <div style={styles.price}>{tier.price}<span style={styles.period}>/mo</span></div>
            <ul style={styles.list}>
              {tier.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <button
              onClick={() => handleCheckout(tier.key)}
              style={tier.key === "agency" ? styles.primary : styles.button}
            >
              {tier.key === "free" ? "Use free" : "Upgrade"}
            </button>
          </article>
        ))}
      </div>
      {checkoutTier && (
        <PaymentCheckout tier={checkoutTier} onClose={() => setCheckoutTier(null)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0f0f1a", color: "#f4f4f5", padding: 0 },
  nav: { height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 36px", borderBottom: "1px solid #272737" },
  brand: { fontSize: 18, fontWeight: 800, color: "#f4f4f5", textDecoration: "none" },
  navLinks: { display: "flex", gap: 18, alignItems: "center" },
  navLink: { color: "#c8c8d2", textDecoration: "none", fontSize: 14 },
  primarySmall: { color: "#fff", background: "#e94560", padding: "9px 14px", borderRadius: 6, textDecoration: "none", fontSize: 14, fontWeight: 700 },
  h1: { fontSize: 40, margin: "40px 32px 12px", color: "#fff", maxWidth: 1080, marginLeft: "auto", marginRight: "auto" },
  sub: { color: "#bbb", fontSize: 17, maxWidth: 680, lineHeight: 1.6, margin: "0 32px", marginLeft: "auto", marginRight: "auto" },
  usage: { margin: "24px 32px", padding: 14, border: "1px solid #33384d", borderRadius: 8, background: "#171724", color: "#d6d6df", maxWidth: 1080, marginLeft: "auto", marginRight: "auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18, margin: "28px 32px 40px", maxWidth: 1080, marginLeft: "auto", marginRight: "auto" },
  card: { background: "#181827", border: "1px solid #343448", borderRadius: 8, padding: 22, display: "flex", flexDirection: "column", gap: 18 },
  h2: { margin: 0, color: "#fff", fontSize: 22 },
  price: { fontSize: 36, fontWeight: 800, color: "#fff" },
  period: { fontSize: 15, color: "#999", marginLeft: 4 },
  list: { margin: 0, paddingLeft: 18, color: "#cfcfda", lineHeight: 1.9, flex: 1 },
  button: { border: "1px solid #55576b", background: "transparent", color: "#f4f4f5", padding: "11px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 800 },
  primary: { border: "1px solid #e94560", background: "#e94560", color: "#fff", padding: "11px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 800 },
};

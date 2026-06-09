import { useEffect, useState } from "react";
import { api } from "../lib/api";

const tiers = [
  { name: "Free", price: "$0", key: "free", points: ["3 packages/month", "1 channel", "Core 7-agent pipeline"] },
  { name: "Pro", price: "$19", key: "pro", points: ["Unlimited packages", "3 channels", "Analytics and advanced agents"] },
  { name: "Agency", price: "$49", key: "agency", points: ["Unlimited packages", "20 channels", "Batch generation and competitor analysis"] },
];

export default function Pricing() {
  const [loadingTier, setLoadingTier] = useState("");
  const [message, setMessage] = useState("");
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    api.getUsage().then(setUsage).catch(() => {});
  }, []);

  const checkout = async (tier: string) => {
    if (tier === "free") {
      setMessage("Free plan is active in local mode.");
      return;
    }
    setLoadingTier(tier);
    setMessage("");
    try {
      const result = await api.createCheckout(tier);
      setMessage(result.status === "mock" ? `Checkout not configured yet. Mock URL: ${result.checkout_url}` : `Checkout ready: ${result.checkout_url}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoadingTier("");
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Pricing</h1>
      <p style={styles.sub}>Start with the local-first workflow, then unlock higher limits when you turn it into a SaaS.</p>
      {usage && <div style={styles.usage}>Current tier: <strong>{usage.tier}</strong> · Packages this month: {usage.packages_this_month.used}/{usage.packages_this_month.limit ?? "unlimited"}</div>}
      <div style={styles.grid}>
        {tiers.map((tier) => (
          <article key={tier.key} style={styles.card}>
            <h2 style={styles.h2}>{tier.name}</h2>
            <div style={styles.price}>{tier.price}<span style={styles.period}>/mo</span></div>
            <ul style={styles.list}>
              {tier.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <button onClick={() => checkout(tier.key)} disabled={loadingTier === tier.key} style={tier.key === "agency" ? styles.primary : styles.button}>
              {loadingTier === tier.key ? "Loading..." : tier.key === "free" ? "Use free" : "Upgrade"}
            </button>
          </article>
        ))}
      </div>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1080, margin: "0 auto", padding: "56px 32px", color: "#f4f4f5" },
  h1: { fontSize: 40, margin: "0 0 12px", color: "#fff" },
  sub: { color: "#bbb", fontSize: 17, maxWidth: 680, lineHeight: 1.6 },
  usage: { margin: "24px 0", padding: 14, border: "1px solid #33384d", borderRadius: 8, background: "#171724", color: "#d6d6df" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18, marginTop: 28 },
  card: { background: "#181827", border: "1px solid #343448", borderRadius: 8, padding: 22, display: "flex", flexDirection: "column", gap: 18 },
  h2: { margin: 0, color: "#fff", fontSize: 22 },
  price: { fontSize: 36, fontWeight: 800, color: "#fff" },
  period: { fontSize: 15, color: "#999", marginLeft: 4 },
  list: { margin: 0, paddingLeft: 18, color: "#cfcfda", lineHeight: 1.9, flex: 1 },
  button: { border: "1px solid #55576b", background: "transparent", color: "#f4f4f5", padding: "11px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 800 },
  primary: { border: "1px solid #e94560", background: "#e94560", color: "#fff", padding: "11px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 800 },
  message: { color: "#8fd3ff", marginTop: 18, overflowWrap: "anywhere" },
};

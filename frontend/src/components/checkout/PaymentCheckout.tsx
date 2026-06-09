import { useState, useEffect } from "react";
import { api } from "../../lib/api";

interface PaymentProvider {
  id: string;
  name: string;
  regions: string[];
  methods?: string[];
}

interface Props {
  tier: string;
  onClose: () => void;
}

export default function PaymentCheckout({ tier, onClose }: Props) {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState("US");

  useEffect(() => {
    api.listPaymentProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    if (providers.length > 0 && !selectedProvider) {
      setSelectedProvider(providers[0].id);
    }
  }, [providers, selectedProvider]);

  const handleCheckout = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await api.createPaymentOrder(tier, selectedProvider, currency, country);
      if (result.status === "ok" && result.checkout_url) {
        window.location.href = result.checkout_url;
      } else if (result.status === "mock") {
        setMessage(`Provider not configured: ${result.detail || "Add keys to .env"}`);
      } else {
        setMessage(result.detail || "Unknown error");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.h2}>Upgrade to {tier === "pro" ? "Pro" : "Agency"}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {providers.length === 0 ? (
          <p style={styles.info}>Loading payment providers...</p>
        ) : (
          <>
            <label style={styles.label}>Payment method</label>
            <div style={styles.providerGrid}>
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  style={{
                    ...styles.providerBtn,
                    ...(selectedProvider === p.id ? styles.providerBtnActive : {}),
                  }}
                >
                  <span style={styles.providerName}>{p.name}</span>
                  <span style={styles.providerRegions}>{p.regions.join(", ")}</span>
                  {p.methods && <span style={styles.providerMethods}>{p.methods.join(" · ")}</span>}
                </button>
              ))}
            </div>

            <div style={styles.row}>
              <label style={styles.label}>
                Currency
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={styles.select}>
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </label>
              <label style={styles.label}>
                Country
                <select value={country} onChange={(e) => setCountry(e.target.value)} style={styles.select}>
                  <option value="US">United States</option>
                  <option value="IN">India</option>
                  <option value="GB">UK</option>
                  <option value="DE">Germany</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                </select>
              </label>
            </div>

            <button onClick={handleCheckout} disabled={loading} style={styles.checkoutBtn}>
              {loading ? "Redirecting..." : `Pay with ${selectedProvider}`}
            </button>

            {message && <p style={styles.message}>{message}</p>}

            <p style={styles.price}>
              {tier === "pro" ? "$19/mo" : "$49/mo"} · Cancel anytime
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    display: "grid", placeItems: "center", zIndex: 1000, padding: 24,
  },
  modal: {
    width: "100%", maxWidth: 520, background: "#181827",
    border: "1px solid #343448", borderRadius: 12, padding: 28,
    color: "#f4f4f5",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  h2: { margin: 0, color: "#fff", fontSize: 24 },
  closeBtn: { background: "none", border: "none", color: "#999", fontSize: 22, cursor: "pointer" },
  label: { display: "block", color: "#bbb", fontSize: 13, marginBottom: 8, fontWeight: 600 },
  info: { color: "#999", textAlign: "center", padding: 24 },
  providerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 },
  providerBtn: {
    background: "#0f0f1a", border: "2px solid #2b2b3d", borderRadius: 8,
    padding: "14px 12px", cursor: "pointer", textAlign: "left",
    display: "flex", flexDirection: "column", gap: 6, color: "#ccc",
    transition: "border-color 0.15s",
  },
  providerBtnActive: { borderColor: "#e94560" },
  providerName: { fontWeight: 700, fontSize: 15, color: "#fff" },
  providerRegions: { fontSize: 12, color: "#888" },
  providerMethods: { fontSize: 12, color: "#8fd3ff" },
  row: { display: "flex", gap: 16, marginBottom: 20 },
  select: {
    display: "block", width: "100%", marginTop: 6,
    background: "#0f0f1a", border: "1px solid #343448", borderRadius: 6,
    padding: "8px 10px", color: "#f4f4f5", fontSize: 14,
  },
  checkoutBtn: {
    width: "100%", padding: "14px", background: "#e94560", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 800,
    fontSize: 16, marginBottom: 12,
  },
  message: { color: "#ffa726", fontSize: 13, marginBottom: 10, overflowWrap: "anywhere" },
  price: { color: "#777", fontSize: 13, textAlign: "center", margin: 0 },
};

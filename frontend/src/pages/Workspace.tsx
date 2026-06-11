import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../lib/storage";
import { getClientId, isDriveConnected } from "../lib/drive_sync";
import type { ProviderKeys, YoutubeOAuthConfig, YoutubeTokens } from "../lib/types";

type WorkspaceState = {
  providerKeys: ProviderKeys;
  channelName: string;
  youtubeConfig: YoutubeOAuthConfig;
  youtubeTokens: YoutubeTokens | null;
  analyticsRefreshedAt?: string;
  packageCount: number;
  driveConfigured: boolean;
};

export default function Workspace() {
  const [state, setState] = useState<WorkspaceState>({
    providerKeys: {},
    channelName: "My Channel",
    youtubeConfig: { client_id: "", client_secret: "" },
    youtubeTokens: null,
    analyticsRefreshedAt: undefined,
    packageCount: 0,
    driveConfigured: false,
  });

  useEffect(() => {
    const load = async () => {
      const [providerKeys, channelProfile, youtubeConfig, youtubeTokens, analyticsCache, packages] = await Promise.all([
        storage.getProviderKeys(),
        storage.getChannelProfile(),
        storage.getYoutubeOAuthConfig(),
        storage.getYoutubeTokens(),
        storage.getAnalyticsCache(),
        storage.listPackages(),
      ]);

      setState({
        providerKeys,
        channelName: channelProfile.name,
        youtubeConfig,
        youtubeTokens,
        analyticsRefreshedAt: analyticsCache.refreshed_at,
        packageCount: packages.length,
        driveConfigured: Boolean(getClientId()) && isDriveConnected(),
      });
    };

    void load();
  }, []);

  const hasAnyKey = Object.values(state.providerKeys).some(Boolean);
  const hasYoutubeConfig = Boolean(state.youtubeConfig.client_id && state.youtubeConfig.client_secret);
  const hasYoutubeConnection = Boolean(state.youtubeTokens?.refresh_token);

  const checklist = useMemo(
    () => [
      {
        label: "Add at least one AI provider key",
        done: hasAnyKey,
        description: "Needed for generation requests. Keys stay in this browser until the user sends a live request.",
        action: { to: "/settings", label: "Open API key setup" },
      },
      {
        label: "Set channel profile",
        done: state.channelName.trim() !== "" && state.channelName !== "My Channel",
        description: "Helps the agent tailor hooks, examples, and tone to the right audience.",
        action: { to: "/settings", label: "Edit channel profile" },
      },
      {
        label: "Connect YouTube",
        done: hasYoutubeConfig && hasYoutubeConnection,
        description: "Lets the app analyze your recent performance and suggest stronger next scripts.",
        action: { to: "/settings", label: "Connect YouTube" },
      },
      {
        label: "Set up backup",
        done: state.driveConfigured,
        description: "Optional. Keep backups in the user's own Google Drive or export a JSON backup locally.",
        action: { to: "/settings", label: "Set up backup" },
      },
    ],
    [hasAnyKey, hasYoutubeConfig, hasYoutubeConnection, state.channelName, state.driveConfigured],
  );

  const completed = checklist.filter((item) => item.done).length;

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Workspace</p>
          <h1 style={styles.h1}>Your setup is {completed === checklist.length ? "ready to run" : "almost ready"}.</h1>
          <p style={styles.sub}>
            This app is browser-first and stateless on your backend. Your keys, tokens, scripts, and analytics stay with the user unless they choose to back them up to their own Drive.
          </p>
        </div>
        <div style={styles.heroCard}>
          <p style={styles.heroStat}>{completed}/{checklist.length}</p>
          <p style={styles.heroLabel}>setup steps completed</p>
          <Link to={hasAnyKey ? "/generate" : "/settings"} style={styles.primaryBtn}>
            {hasAnyKey ? "Generate a script" : "Finish setup"}
          </Link>
        </div>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.h2}>Readiness checklist</h2>
            <span style={styles.badge}>{completed}/{checklist.length}</span>
          </div>
          <div style={styles.checklist}>
            {checklist.map((item) => (
              <div key={item.label} style={styles.checkItem}>
                <div>
                  <p style={styles.checkTitle}>{item.done ? "Ready" : "Pending"}: {item.label}</p>
                  <p style={styles.checkText}>{item.description}</p>
                </div>
                <Link to={item.action.to} style={item.done ? styles.secondaryBtn : styles.inlineBtn}>
                  {item.action.label}
                </Link>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.h2}>Workspace snapshot</h2>
          <div style={styles.metrics}>
            <Metric label="Saved scripts" value={String(state.packageCount)} />
            <Metric label="AI providers ready" value={hasAnyKey ? "Yes" : "No"} />
            <Metric label="YouTube connected" value={hasYoutubeConnection ? "Yes" : "No"} />
            <Metric label="Analytics refreshed" value={state.analyticsRefreshedAt ? new Date(state.analyticsRefreshedAt).toLocaleDateString() : "Never"} />
          </div>
        </article>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.h2}>Recommended next steps</h2>
          <div style={styles.quickActions}>
            <Link to="/settings" style={styles.actionCard}>
              <p style={styles.actionTitle}>Configure keys and YouTube</p>
              <p style={styles.actionText}>Best first move for a new user.</p>
            </Link>
            <Link to="/analytics" style={styles.actionCard}>
              <p style={styles.actionTitle}>Analyze recent videos</p>
              <p style={styles.actionText}>Use actual channel signals instead of guessing topics.</p>
            </Link>
            <Link to="/generate" style={styles.actionCard}>
              <p style={styles.actionTitle}>Generate a package</p>
              <p style={styles.actionText}>Create a hook, outline, script, titles, and thumbnail angle.</p>
            </Link>
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.h2}>How to talk about the product</h2>
          <p style={styles.note}>
            Promise signal-based guidance, not a magic YouTube algorithm decoder. The agents should study CTR, retention, topic patterns, and your own results to improve the next upload decision.
          </p>
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={styles.metricValue}>{value}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: 24, maxWidth: 1100, margin: "0 auto" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(260px, 0.9fr)", gap: 20, alignItems: "stretch" },
  kicker: { margin: 0, color: "#8fd3ff", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.8 },
  h1: { margin: "10px 0 12px", fontSize: 34, lineHeight: 1.15, color: "#fff" },
  sub: { margin: 0, color: "#b8b8c9", lineHeight: 1.7, fontSize: 15 },
  heroCard: { border: "1px solid #2a3144", borderRadius: 18, background: "linear-gradient(180deg, #161b2b 0%, #101521 100%)", padding: 24, display: "grid", alignContent: "start", gap: 8 },
  heroStat: { margin: 0, fontSize: 42, fontWeight: 800, color: "#fff" },
  heroLabel: { margin: 0, color: "#9ca3af", fontSize: 13 },
  primaryBtn: { marginTop: 12, display: "inline-flex", justifyContent: "center", alignItems: "center", padding: "12px 16px", borderRadius: 10, background: "#e94560", color: "#fff", textDecoration: "none", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 },
  card: { border: "1px solid #2a2f42", borderRadius: 16, background: "#121624", padding: 20 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 },
  h2: { margin: 0, color: "#fff", fontSize: 18 },
  badge: { borderRadius: 999, background: "#1f2937", color: "#cbd5e1", padding: "6px 10px", fontSize: 12, fontWeight: 700 },
  checklist: { display: "grid", gap: 12 },
  checkItem: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "14px 0", borderTop: "1px solid #23293a" },
  checkTitle: { margin: 0, color: "#f3f4f6", fontWeight: 700, fontSize: 14 },
  checkText: { margin: "6px 0 0", color: "#9ca3af", lineHeight: 1.6, fontSize: 13 },
  inlineBtn: { whiteSpace: "nowrap", padding: "10px 12px", borderRadius: 8, background: "#e94560", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 },
  secondaryBtn: { whiteSpace: "nowrap", padding: "10px 12px", borderRadius: 8, border: "1px solid #344054", color: "#d1d5db", textDecoration: "none", fontSize: 13, fontWeight: 700 },
  metrics: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 16 },
  metricCard: { borderRadius: 12, border: "1px solid #252b3d", background: "#0f1320", padding: 14 },
  metricLabel: { margin: 0, color: "#9ca3af", fontSize: 12 },
  metricValue: { margin: "8px 0 0", color: "#fff", fontWeight: 800, fontSize: 22 },
  quickActions: { display: "grid", gap: 12, marginTop: 16 },
  actionCard: { display: "block", borderRadius: 12, border: "1px solid #252b3d", background: "#0f1320", padding: 16, textDecoration: "none" },
  actionTitle: { margin: 0, color: "#fff", fontWeight: 700, fontSize: 15 },
  actionText: { margin: "6px 0 0", color: "#9ca3af", lineHeight: 1.6, fontSize: 13 },
  note: { margin: "16px 0 0", color: "#cbd5e1", lineHeight: 1.7, fontSize: 14 },
};

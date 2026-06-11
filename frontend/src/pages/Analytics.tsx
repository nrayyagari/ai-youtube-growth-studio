import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import type { ProviderKeys, YoutubeAnalyticsCache, YoutubeOAuthConfig, YoutubeTokens } from "../lib/types";

type LoadState = "idle" | "loading" | "error";

export default function Analytics() {
  const [oauth, setOauth] = useState<YoutubeOAuthConfig>({ client_id: "", client_secret: "" });
  const [tokens, setTokens] = useState<YoutubeTokens | null>(null);
  const [cache, setCache] = useState<YoutubeAnalyticsCache>({});
  const [providerKeys, setProviderKeys] = useState<ProviderKeys>({});
  const [loadingAnalytics, setLoadingAnalytics] = useState<LoadState>("idle");
  const [loadingIdeas, setLoadingIdeas] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const [oauthConfig, storedTokens, analyticsCache, keys] = await Promise.all([
        storage.getYoutubeOAuthConfig(),
        storage.getYoutubeTokens(),
        storage.getAnalyticsCache(),
        storage.getProviderKeys(),
      ]);
      setOauth(oauthConfig);
      setTokens(storedTokens);
      setCache(analyticsCache);
      setProviderKeys(keys);
    };
    void load();
  }, []);

  const hasYoutubeConfig = !!oauth.client_id && !!oauth.client_secret;
  const hasConnection = !!tokens?.refresh_token;
  const topVideo = cache.videos?.[0];
  const recommendations = useMemo(() => {
    const raw = cache.recommendations?.recommendations;
    return Array.isArray(raw) ? raw : [];
  }, [cache.recommendations]);

  const refreshAnalytics = async () => {
    if (!tokens?.refresh_token || !oauth.client_id || !oauth.client_secret) {
      setError("Connect YouTube first in Settings.");
      return;
    }
    setLoadingAnalytics("loading");
    setError("");
    try {
      const payload = await api.fetchMyRecentVideos(tokens.refresh_token, oauth.client_id, oauth.client_secret);
      const nextCache = {
        ...cache,
        ...payload,
        refreshed_at: new Date().toISOString(),
      };
      setCache(nextCache);
      await storage.setAnalyticsCache(nextCache);
      setLoadingAnalytics("idle");
    } catch (err) {
      setLoadingAnalytics("error");
      setError(err instanceof Error ? err.message : "Failed to refresh analytics.");
    }
  };

  const generateRecommendations = async () => {
    if (!tokens?.refresh_token || !oauth.client_id || !oauth.client_secret) {
      setError("Connect YouTube first in Settings.");
      return;
    }
    if (!Object.values(providerKeys).some(Boolean)) {
      setError("Add at least one AI provider key in Settings.");
      return;
    }
    setLoadingIdeas("loading");
    setError("");
    try {
      const recommendationsPayload = await api.suggestYoutubeContent({
        refreshToken: tokens.refresh_token,
        clientId: oauth.client_id,
        clientSecret: oauth.client_secret,
        apiKeys: providerKeys as Record<string, string>,
        maxResults: 10,
      });
      const nextCache = {
        ...cache,
        recommendations: recommendationsPayload,
        refreshed_at: new Date().toISOString(),
      };
      setCache(nextCache);
      await storage.setAnalyticsCache(nextCache);
      setLoadingIdeas("idle");
    } catch (err) {
      setLoadingIdeas("error");
      setError(err instanceof Error ? err.message : "Failed to generate recommendations.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Analytics</h1>
          <p style={styles.sub}>Use your real YouTube analytics to decide the next script worth making.</p>
        </div>
        <div style={styles.actions}>
          <button onClick={refreshAnalytics} disabled={!hasConnection || loadingAnalytics === "loading"} style={styles.primaryBtn}>
            {loadingAnalytics === "loading" ? "Refreshing..." : "Refresh Analytics"}
          </button>
          <button onClick={generateRecommendations} disabled={!hasConnection || loadingIdeas === "loading"} style={styles.secondaryBtn}>
            {loadingIdeas === "loading" ? "Thinking..." : "Generate Next Scripts"}
          </button>
        </div>
      </div>

      {!hasYoutubeConfig && (
        <div style={styles.notice}>
          <strong style={styles.noticeTitle}>YouTube is not configured in this browser.</strong>
          <p style={styles.noticeText}>Add your YouTube OAuth client ID and secret in <Link to="/settings" style={styles.link}>Settings</Link>, then connect your channel.</p>
        </div>
      )}

      {hasYoutubeConfig && !hasConnection && (
        <div style={styles.notice}>
          <strong style={styles.noticeTitle}>YouTube is configured but not connected.</strong>
          <p style={styles.noticeText}>Finish the YouTube connect flow in <Link to="/settings" style={styles.link}>Settings</Link> to fetch channel analytics.</p>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Channel Snapshot</h2>
          <div style={styles.metricGrid}>
            <Metric label="Subscribers" value={formatNumber(cache.channel_stats?.subscriber_count)} />
            <Metric label="Total Views (30d)" value={formatNumber(cache.analytics?.total_views)} />
            <Metric label="Watch Minutes" value={formatNumber(cache.analytics?.total_watch_minutes)} />
            <Metric label="Avg View %" value={formatPercent(cache.analytics?.avg_view_percentage)} />
          </div>
          <p style={styles.muted}>Last refreshed: {cache.refreshed_at ? new Date(cache.refreshed_at).toLocaleString() : "Never"}</p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Best Recent Video</h2>
          {topVideo ? (
            <div>
              <p style={styles.videoTitle}>{topVideo.title || "Untitled video"}</p>
              <p style={styles.videoMeta}>Views: {formatNumber(topVideo.views)} · CTR: {formatPercent(topVideo.ctr)} · Avg view %: {formatPercent(topVideo.avg_view_percentage)}</p>
            </div>
          ) : (
            <p style={styles.muted}>Refresh analytics to see what is working right now.</p>
          )}
        </section>
      </div>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.cardTitle}>Recent Videos</h2>
          <span style={styles.badge}>{cache.videos?.length || 0} loaded</span>
        </div>
        {!cache.videos?.length ? (
          <p style={styles.muted}>No recent videos loaded yet.</p>
        ) : (
          <div style={styles.videoList}>
            {cache.videos.slice(0, 8).map((video, index) => (
              <div key={video.video_id || `${video.title}-${index}`} style={styles.videoRow}>
                <div>
                  <p style={styles.videoTitle}>{video.title || "Untitled video"}</p>
                  <p style={styles.videoMeta}>Published: {video.published_at ? new Date(video.published_at).toLocaleDateString() : "Unknown date"}</p>
                </div>
                <div style={styles.videoStats}>
                  <span>{formatNumber(video.views)} views</span>
                  <span>{formatPercent(video.avg_view_percentage)} avg view</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.cardTitle}>Recommended Next Scripts</h2>
          <span style={styles.badge}>{recommendations.length || 0} ideas</span>
        </div>
        {!recommendations.length ? (
          <p style={styles.muted}>Generate recommendations after loading your analytics.</p>
        ) : (
          <div style={styles.ideaGrid}>
            {recommendations.map((idea: any, index: number) => (
              <article key={`${idea.title || idea.topic}-${index}`} style={styles.ideaCard}>
                <p style={styles.ideaLabel}>Idea {index + 1}</p>
                <h3 style={styles.ideaTitle}>{idea.title || idea.topic || "Untitled recommendation"}</h3>
                <p style={styles.ideaText}>{idea.reasoning || "This idea is recommended based on your current channel performance."}</p>
                <p style={styles.ideaText}><strong>Hook:</strong> {idea.hook || "Not provided"}</p>
                <Link to={`/generate?topic=${encodeURIComponent(idea.title || idea.topic || "")}`} style={styles.ideaLink}>
                  Use this idea
                </Link>
              </article>
            ))}
          </div>
        )}
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

function formatNumber(value: unknown) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat().format(Math.round(value));
}

function formatPercent(value: unknown) {
  if (typeof value !== "number") return "—";
  return `${Math.round(value * 10) / 10}%`;
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: 18 },
  header: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" },
  h1: { margin: 0, color: "#fff", fontSize: 28 },
  sub: { margin: "8px 0 0", color: "#a8a8bb", fontSize: 14, maxWidth: 620, lineHeight: 1.6 },
  actions: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryBtn: { padding: "12px 16px", borderRadius: 8, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: 700 },
  secondaryBtn: { padding: "12px 16px", borderRadius: 8, border: "1px solid #444", background: "#151524", color: "#ddd", cursor: "pointer", fontWeight: 700 },
  notice: { padding: 18, border: "1px solid #334155", borderRadius: 12, background: "#111827" },
  noticeTitle: { display: "block", color: "#fff", marginBottom: 6 },
  noticeText: { margin: 0, color: "#b6c2d1", lineHeight: 1.6 },
  link: { color: "#8fd3ff", textDecoration: "none" },
  error: { color: "#f87171", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 },
  card: { background: "#181827", border: "1px solid #343448", borderRadius: 14, padding: 20 },
  cardTitle: { margin: 0, color: "#fff", fontSize: 18 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 16 },
  metricCard: { padding: 14, borderRadius: 10, background: "#11111c", border: "1px solid #2b2b3d" },
  metricLabel: { margin: 0, color: "#8f93a7", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 },
  metricValue: { margin: "8px 0 0", color: "#fff", fontSize: 22, fontWeight: 700 },
  muted: { color: "#8f93a7", marginTop: 14, marginBottom: 0, fontSize: 13 },
  videoList: { display: "grid", gap: 10 },
  videoRow: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid #252538" },
  videoTitle: { margin: 0, color: "#fff", fontSize: 15, fontWeight: 600 },
  videoMeta: { margin: "6px 0 0", color: "#8f93a7", fontSize: 12 },
  videoStats: { display: "grid", gap: 6, color: "#d2d6e5", fontSize: 12, textAlign: "right" },
  badge: { display: "inline-block", padding: "4px 10px", borderRadius: 999, background: "#11111c", border: "1px solid #303046", color: "#cbd5e1", fontSize: 12 },
  ideaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  ideaCard: { padding: 16, borderRadius: 12, background: "#11111c", border: "1px solid #2b2b3d" },
  ideaLabel: { margin: 0, color: "#8fd3ff", fontSize: 12, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.4 },
  ideaTitle: { margin: "10px 0 8px", color: "#fff", fontSize: 18 },
  ideaText: { margin: "0 0 10px", color: "#bcc2d3", lineHeight: 1.6, fontSize: 13 },
  ideaLink: { color: "#fff", background: "#e94560", padding: "10px 12px", borderRadius: 8, textDecoration: "none", display: "inline-block", fontWeight: 700, fontSize: 13 },
};

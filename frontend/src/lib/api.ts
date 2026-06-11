const API_BASE = "";

function buildHeaders(options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { ...headers, ...((options.headers as Record<string, string>) || {}) };
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(options),
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Generation
  generate: (data: { topic: string; reference_url?: string; api_keys: Record<string, string>; channel: Record<string, string> }) =>
    request("/api/generate", { method: "POST", body: JSON.stringify(data) }),

  // Streaming generation
  generateStream: (data: { topic: string; reference_url?: string; api_keys: Record<string, string>; channel: Record<string, string> }) => {
    return fetch(`${API_BASE}/api/generate/stream`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(data),
    });
  },

  // Workflows (hardcoded list)
  listWorkflows: () => request("/api/workflows"),

  // Reference analysis
  analyzeReference: (url: string) =>
    request("/api/analyze", { method: "POST", body: JSON.stringify({ url }) }),

  // YouTube
  getYoutubeOAuthUrl: (clientId: string, clientSecret: string, redirectUri?: string) =>
    request("/api/youtube/oauth/url", {
      method: "POST",
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    }),
  exchangeYoutubeCode: (clientId: string, clientSecret: string, code: string, redirectUri: string) =>
    request("/api/youtube/exchange-code", {
      method: "POST",
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    }),
  fetchMyRecentVideos: (refreshToken: string, clientId?: string, clientSecret?: string) =>
    request("/api/youtube/my-recent-videos", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
    }),
  checkYoutubeStatus: (refreshToken: string, clientId?: string, clientSecret?: string) =>
    request("/api/youtube/oauth/status", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
    }),
  suggestYoutubeContent: (data: { refreshToken: string; clientId?: string; clientSecret?: string; apiKeys: Record<string, string>; maxResults?: number }) =>
    request("/api/youtube/suggest", {
      method: "POST",
      body: JSON.stringify({
        refresh_token: data.refreshToken,
        client_id: data.clientId,
        client_secret: data.clientSecret,
        api_keys: data.apiKeys,
        max_results: data.maxResults,
      }),
    }),

  // OTP Auth
  otpSend: (email: string) =>
    request("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ email }) }),
  otpVerify: (email: string, otp: string) =>
    request("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ email, otp }) }),
  getMe: () =>
    request("/api/auth/me"),
};

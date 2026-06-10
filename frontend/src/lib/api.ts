const API_BASE = "";

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
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
      headers: { "Content-Type": "application/json" },
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
  checkYoutubeStatus: (refreshToken: string) =>
    request("/api/youtube/oauth/status", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  // OTP Auth
  otpSend: (email: string) =>
    request("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ email }) }),
  otpVerify: (email: string, otp: string) =>
    request("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ email, otp }) }),
  getMe: (token: string) =>
    request(`/api/auth/me?token=${encodeURIComponent(token)}`),
};

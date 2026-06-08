const API_BASE = "";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Channels
  createChannel: (data: any) => request("/api/channels", { method: "POST", body: JSON.stringify(data) }),
  listChannels: () => request("/api/channels"),
  getChannel: (id: number) => request(`/api/channels/${id}`),
  updateChannel: (id: number, data: any) =>
    request(`/api/channels/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteChannel: (id: number) => request(`/api/channels/${id}`, { method: "DELETE" }),

  // Workflows
  listWorkflows: () => request("/api/workflows"),

  // Skills
  listSkills: (category?: string) =>
    request(`/api/skills${category ? `?category=${category}` : ""}`),

  // Packages
  generate: (channelId: number, workflowId: number, topic = "") =>
    request("/api/generate", {
      method: "POST",
      body: JSON.stringify({ channel_id: channelId, workflow_id: workflowId, topic }),
    }),
  listPackages: (channelId?: number, status?: string) => {
    const params = new URLSearchParams();
    if (channelId) params.set("channel_id", String(channelId));
    if (status) params.set("status", status);
    return request(`/api/packages?${params}`);
  },
  getPackage: (id: number) => request(`/api/packages/${id}`),
  deletePackage: (id: number) => request(`/api/packages/${id}`, { method: "DELETE" }),
  regenerate: (packageId: number) =>
    request(`/api/packages/${packageId}/regenerate`, { method: "POST", body: "{}" }),

  // Settings
  getApiKeys: () => request("/api/settings/apikeys"),
  updateApiKeys: (keys: any) =>
    request("/api/settings/apikeys", { method: "PUT", body: JSON.stringify(keys) }),

  // Reference Videos
  addReferenceVideo: (channelId: number, url: string) =>
    request(`/api/channels/${channelId}/reference-videos`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  listReferenceVideos: (channelId: number) =>
    request(`/api/channels/${channelId}/reference-videos`),
  deleteReferenceVideo: (id: number) =>
    request(`/api/reference-videos/${id}`, { method: "DELETE" }),

  // Style Profiles
  generateStyleProfile: (channelId: number, name: string) =>
    request(`/api/channels/${channelId}/style-profiles/generate`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  listStyleProfiles: (channelId: number) =>
    request(`/api/channels/${channelId}/style-profiles`),
  deleteStyleProfile: (id: number) =>
    request(`/api/style-profiles/${id}`, { method: "DELETE" }),
};

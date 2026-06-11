import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function createMockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
  };
}

import { api } from "../lib/api";

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
  mockFetch.mockResolvedValue(createMockResponse({}));
});

describe("api", () => {
  it("adds bearer token automatically", async () => {
    localStorage.setItem("auth_token", "abc123");
    await api.listWorkflows();
    expect(mockFetch).toHaveBeenCalledWith("/api/workflows", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer abc123",
      }),
    }));
  });

  it("generate posts stateless payload", async () => {
    mockFetch.mockResolvedValue(createMockResponse({ id: "pkg-1" }));
    await api.generate({
      topic: "AI for creators",
      api_keys: { gemini: "key-1" },
      channel: { name: "Creator Lab", language: "en" },
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/generate", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        topic: "AI for creators",
        api_keys: { gemini: "key-1" },
        channel: { name: "Creator Lab", language: "en" },
      }),
    }));
  });

  it("youtube status posts refresh token without persistence helpers", async () => {
    await api.checkYoutubeStatus("refresh-1", "cid", "secret");
    expect(mockFetch).toHaveBeenCalledWith("/api/youtube/oauth/status", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        refresh_token: "refresh-1",
        client_id: "cid",
        client_secret: "secret",
      }),
    }));
  });

  it("getMe calls the stateless me endpoint", async () => {
    await api.getMe();
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/me", expect.anything());
  });

  it("throws error with detail on non-ok response", async () => {
    mockFetch.mockResolvedValue(createMockResponse({ detail: "Not found" }, false, 404));
    await expect(api.listWorkflows()).rejects.toThrow("Not found");
  });
});

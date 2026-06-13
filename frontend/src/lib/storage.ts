import type { ChannelProfile, ProviderKeys, VideoPackage, YoutubeOAuthConfig, YoutubeTokens } from "./types";

const DB_NAME = "growth_studio";
const DB_VERSION = 2;
const BACKUP_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("packages")) {
        db.createObjectStore("packages", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("reference_videos")) {
        db.createObjectStore("reference_videos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("workspace")) {
        db.createObjectStore("workspace", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function generateId(): string {
  return crypto.randomUUID();
}

export const storage = {
  // ─── Packages ─────────────────────────────────────
  async listPackages(): Promise<VideoPackage[]> {
    const db = await openDB();
    const tx = db.transaction("packages", "readonly");
    const store = tx.objectStore("packages");
    const all = await new Promise<VideoPackage[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  },

  async getPackage(id: string): Promise<VideoPackage | null> {
    const db = await openDB();
    const tx = db.transaction("packages", "readonly");
    const store = tx.objectStore("packages");
    const result = await new Promise<VideoPackage | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  },

  async savePackage(pkg: VideoPackage): Promise<string> {
    const db = await openDB();
    const tx = db.transaction("packages", "readwrite");
    const store = tx.objectStore("packages");
    const id = pkg.id || generateId();
    store.put({ ...pkg, id, created_at: pkg.created_at || new Date().toISOString() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return id;
  },

  async deletePackage(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("packages", "readwrite");
    const store = tx.objectStore("packages");
    store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  // ─── Reference Videos ─────────────────────────────
  async listReferenceVideos(): Promise<any[]> {
    const db = await openDB();
    const tx = db.transaction("reference_videos", "readonly");
    const store = tx.objectStore("reference_videos");
    const all = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all;
  },

  async saveReferenceVideo(video: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("reference_videos", "readwrite");
    const store = tx.objectStore("reference_videos");
    store.put({ ...video, id: video.id || generateId() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  async deleteReferenceVideo(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("reference_videos", "readwrite");
    const store = tx.objectStore("reference_videos");
    store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  // ─── Settings ─────────────────────────────────────
  async getSetting(key: string): Promise<any | null> {
    const db = await openDB();
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    const result = await new Promise<any>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  },

  async setSetting(key: string, value: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");
    store.put({ key, value, updated_at: new Date().toISOString() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  // ─── Workspace State ──────────────────────────────
  async getWorkspaceValue<T>(key: string): Promise<T | null> {
    const db = await openDB();
    const tx = db.transaction("workspace", "readonly");
    const store = tx.objectStore("workspace");
    const result = await new Promise<T | null>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  },

  async setWorkspaceValue<T>(key: string, value: T): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    store.put({ key, value, updated_at: new Date().toISOString() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  async getProviderKeys(): Promise<ProviderKeys> {
    return (await this.getWorkspaceValue<ProviderKeys>("provider_keys")) || {};
  },

  async setProviderKeys(keys: ProviderKeys): Promise<void> {
    await this.setWorkspaceValue("provider_keys", keys);
  },

  async getChannelProfile(): Promise<ChannelProfile> {
    return (
      (await this.getWorkspaceValue<ChannelProfile>("channel_profile")) || {
        name: "My Channel",
        niche: "",
        audience: "General audience",
        language: "en",
        channel_url: "",
      }
    );
  },

  async setChannelProfile(profile: ChannelProfile): Promise<void> {
    await this.setWorkspaceValue("channel_profile", profile);
  },

  async getYoutubeTokens(): Promise<YoutubeTokens | null> {
    return this.getWorkspaceValue<YoutubeTokens>("youtube_tokens");
  },

  async setYoutubeTokens(tokens: YoutubeTokens | null): Promise<void> {
    await this.setWorkspaceValue("youtube_tokens", tokens);
  },

  async getYoutubeOAuthConfig(): Promise<YoutubeOAuthConfig> {
    return (await this.getWorkspaceValue<YoutubeOAuthConfig>("youtube_oauth_config")) || {
      client_id: "",
      client_secret: "",
    };
  },

  async setYoutubeOAuthConfig(config: YoutubeOAuthConfig): Promise<void> {
    await this.setWorkspaceValue("youtube_oauth_config", config);
  },

  async getAnalyticsCache(): Promise<Record<string, any>> {
    return (await this.getWorkspaceValue<Record<string, any>>("analytics_cache")) || {};
  },

  async setAnalyticsCache(data: Record<string, any>): Promise<void> {
    await this.setWorkspaceValue("analytics_cache", data);
  },

  // ─── Export / Import ──────────────────────────────
  async exportAll(): Promise<Blob> {
    const db = await openDB();
    const data: Record<string, any[]> = {};
    const stores = ["packages", "reference_videos", "settings", "workspace"];
    for (const name of stores) {
      const tx = db.transaction(name, "readonly");
      const store = tx.objectStore(name);
      data[name] = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }
    db.close();
    return new Blob([JSON.stringify({ backup_version: BACKUP_VERSION, exported_at: new Date().toISOString(), stores: data }, null, 2)], { type: "application/json" });
  },

  async importAll(data: Record<string, any[]>): Promise<number> {
    let count = 0;
    const db = await openDB();
    const stores = Array.isArray((data as any).packages) ? data : ((data as any).stores || {});
    for (const [storeName, items] of Object.entries(stores as Record<string, any[]>)) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const item of items || []) {
        store.put(item);
        count++;
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
    return count;
  },

  // ─── Global clear (for logout) ────────────────────
  async clearAll(): Promise<void> {
    const db = await openDB();
    for (const name of db.objectStoreNames) {
      const tx = db.transaction(name, "readwrite");
      tx.objectStore(name).clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  },
};

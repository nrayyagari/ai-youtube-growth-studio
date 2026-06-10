const DB_NAME = "growth_studio";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("packages")) {
        db.createObjectStore("packages", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("channels")) {
        db.createObjectStore("channels", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("reference_videos")) {
        db.createObjectStore("reference_videos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("style_profiles")) {
        db.createObjectStore("style_profiles", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
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
  async listPackages(): Promise<any[]> {
    const db = await openDB();
    const tx = db.transaction("packages", "readonly");
    const store = tx.objectStore("packages");
    const all = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  },

  async getPackage(id: string): Promise<any | null> {
    const db = await openDB();
    const tx = db.transaction("packages", "readonly");
    const store = tx.objectStore("packages");
    const result = await new Promise<any>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  },

  async savePackage(pkg: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("packages", "readwrite");
    const store = tx.objectStore("packages");
    store.put({ ...pkg, id: pkg.id || generateId(), created_at: pkg.created_at || new Date().toISOString() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
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

  // ─── Channels ─────────────────────────────────────
  async listChannels(): Promise<any[]> {
    const db = await openDB();
    const tx = db.transaction("channels", "readonly");
    const store = tx.objectStore("channels");
    const all = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all;
  },

  async saveChannel(channel: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("channels", "readwrite");
    const store = tx.objectStore("channels");
    store.put({ ...channel, id: channel.id || generateId() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  async deleteChannel(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("channels", "readwrite");
    const store = tx.objectStore("channels");
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

  // ─── Export / Import ──────────────────────────────
  async exportAll(): Promise<Blob> {
    const db = await openDB();
    const data: Record<string, any[]> = {};
    const stores = ["packages", "channels", "reference_videos", "style_profiles", "settings"];
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
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  },

  async importAll(data: Record<string, any[]>): Promise<number> {
    let count = 0;
    const db = await openDB();
    for (const [storeName, items] of Object.entries(data)) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const item of items) {
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

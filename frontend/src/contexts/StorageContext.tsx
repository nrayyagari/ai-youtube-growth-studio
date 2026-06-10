import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { storage } from "../lib/storage";

interface StorageContextValue {
  packages: any[];
  channels: any[];
  referenceVideos: any[];
  settings: Record<string, any>;
  loading: boolean;
  refreshPackages: () => Promise<void>;
  refreshChannels: () => Promise<void>;
  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: any) => Promise<void>;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const [packages, setPackages] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [referenceVideos, setReferenceVideos] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const refreshPackages = useCallback(async () => {
    const data = await storage.listPackages();
    setPackages(data);
  }, []);

  const refreshChannels = useCallback(async () => {
    const data = await storage.listChannels();
    setChannels(data);
  }, []);

  const refreshReferenceVideos = useCallback(async () => {
    const data = await storage.listReferenceVideos();
    setReferenceVideos(data);
  }, []);

  const getSetting = useCallback(async (key: string) => {
    return storage.getSetting(key);
  }, []);

  const setSetting = useCallback(async (key: string, value: any) => {
    await storage.setSetting(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    Promise.all([
      refreshPackages(),
      refreshChannels(),
      refreshReferenceVideos(),
    ]).finally(() => setLoading(false));
  }, [refreshPackages, refreshChannels, refreshReferenceVideos]);

  return (
    <StorageContext.Provider value={{
      packages, channels, referenceVideos, settings,
      loading, refreshPackages, refreshChannels,
      getSetting, setSetting,
    }}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used within StorageProvider");
  return ctx;
}

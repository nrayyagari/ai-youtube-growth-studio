import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { Channel, Workflow, Skill, VideoPackage } from "../lib/types";

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.listChannels();
      setChannels(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (data: any) => {
    await api.createChannel(data);
    await load();
  };

  const remove = async (id: number) => {
    await api.deleteChannel(id);
    await load();
  };

  return { channels, loading, error, reload: load, create, remove };
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listWorkflows().then(setWorkflows).finally(() => setLoading(false));
  }, []);

  return { workflows, loading };
}

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (category?: string) => {
    setLoading(true);
    const data = await api.listSkills(category);
    setSkills(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { skills, loading, load };
}

export function usePackages(channelId?: number, status?: string) {
  const [packages, setPackages] = useState<VideoPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.listPackages(channelId, status);
      setPackages(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [channelId, status]);

  useEffect(() => { load(); }, [load]);

  return { packages, loading, error, reload: load };
}

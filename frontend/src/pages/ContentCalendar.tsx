import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Channel, CalendarEntry, PublishingSlot, Workflow } from "../lib/types";
import { LoadingState } from "../components/ui/ErrorBoundary";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6);

export default function ContentCalendar() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [slots, setSlots] = useState<PublishingSlot[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"calendar" | "batch">("calendar");
  const [weekOffset, setWeekOffset] = useState(0);

  const [batchTopics, setBatchTopics] = useState("");
  const [batchWorkflow, setBatchWorkflow] = useState("");
  const [batchDays, setBatchDays] = useState(7);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  const [newSlot, setNewSlot] = useState({ day: 1, hour: 9, label: "" });

  useEffect(() => {
    Promise.all([
      api.listChannels().then(setChannels),
      api.listWorkflows().then(setWorkflows),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedChannel) loadData(selectedChannel);
  }, [selectedChannel, weekOffset]);

  const loadData = async (chId: number) => {
    setError("");
    try {
      const [ents, sl] = await Promise.all([
        api.listCalendar(chId),
        api.listSlots(chId),
      ]);
      setEntries(Array.isArray(ents) ? ents : []);
      setSlots(Array.isArray(sl) ? sl : []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const getStartOfWeek = () => {
    const now = new Date();
    now.setDate(now.getDate() + weekOffset * 7);
    const day = now.getDay();
    const diff = now.getDate() - day;
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const weekStart = getStartOfWeek();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const getEntryForDate = (date: Date) => {
    const ds = date.toISOString().split("T")[0];
    return entries.filter((e) => e.scheduled_date === ds);
  };

  const handleBatchGenerate = async () => {
    if (!selectedChannel || !batchWorkflow || !batchTopics.trim()) return;
    setBatchGenerating(true);
    setError("");
    setBatchResult(null);
    try {
      const topics = batchTopics.split("\n").filter((t) => t.trim());
      const result = await api.batchGenerate(selectedChannel, Number(batchWorkflow), topics, batchDays);
      setBatchResult(result);
      loadData(selectedChannel);
    } catch (e: any) {
      setError(e.message);
    }
    setBatchGenerating(false);
  };

  const handleAddSlot = async () => {
    if (!selectedChannel) return;
    try {
      await api.addSlot(selectedChannel, newSlot.day, newSlot.hour, newSlot.label || `Slot ${newSlot.day} ${newSlot.hour}:00`);
      loadData(selectedChannel);
      setNewSlot({ day: 1, hour: 9, label: "" });
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, color: "#e0e0e0", margin: 0 }}>Content Calendar</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTab("calendar")} style={{ ...styles.tabBtn, ...(tab === "calendar" ? styles.tabActive : {}) }}>Calendar</button>
          <button onClick={() => setTab("batch")} style={{ ...styles.tabBtn, ...(tab === "batch" ? styles.tabActive : {}) }}>Batch Generate</button>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <select style={styles.select} value={selectedChannel || ""} onChange={(e) => setSelectedChannel(Number(e.target.value) || null)}>
          <option value="">Select Channel...</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.niche ? ` (${c.niche})` : ""}</option>
          ))}
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!selectedChannel && (
        <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Select a channel to view its calendar.</p>
      )}

      {selectedChannel && tab === "calendar" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button onClick={() => setWeekOffset((w) => w - 1)} style={styles.navBtn}>← Prev Week</button>
            <span style={{ color: "#ccc", fontSize: 14 }}>
              {weekDays[0].toLocaleDateString()} — {weekDays[6].toLocaleDateString()}
            </span>
            <button onClick={() => setWeekOffset((w) => w + 1)} style={styles.navBtn}>Next Week →</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 2, background: "#1a1a2e", borderRadius: 8, border: "1px solid #333", overflow: "hidden" }}>
            <div style={{ ...styles.cellHeader, background: "#0f0f1a" }}></div>
            {weekDays.map((d) => (
              <div key={d.toISOString()} style={{ ...styles.cellHeader, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#888" }}>{DAYS[d.getDay()]}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: d.toDateString() === new Date().toDateString() ? "#e94560" : "#eee" }}>{d.getDate()}</div>
              </div>
            ))}
            {HOURS.map((h) => (
              <>
                <div key={`h-${h}`} style={{ ...styles.cellHeader, padding: "6px 8px", textAlign: "right", fontSize: 11, color: "#666" }}>
                  {h}:00
                </div>
                {weekDays.map((d) => {
                  const dayEntries = getEntryForDate(d);
                  const hourEntries = dayEntries.filter((e) => {
                    if (!e.slot_name) return false;
                    const slot = slots.find((s) => s.label === e.slot_name);
                    return slot && slot.hour === h;
                  });
  if (loading) return <LoadingState text="Loading calendar..." />;

  return (
                    <div key={`${d.toISOString()}-${h}`} style={{ ...styles.cell, background: hourEntries.length > 0 ? "rgba(233,69,96,0.1)" : undefined }}>
                      {hourEntries.map((e) => (
                        <div key={e.id} style={{ fontSize: 10, color: "#e94560", padding: "2px 4px", borderRadius: 3, background: "rgba(233,69,96,0.2)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.notes || e.slot_name}>
                          {e.slot_name || "📦"}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
            <div style={styles.card}>
              <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 12 }}>Publishing Slots</h3>
              {slots.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #2a2a3a", fontSize: 13 }}>
                  <span style={{ color: "#aaa" }}>{DAYS[s.day_of_week]} {s.hour}:00 — {s.label || "Unnamed"}</span>
                  <button onClick={() => api.deleteSlot(s.id).then(() => loadData(selectedChannel!))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14 }}>×</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                <select value={newSlot.day} onChange={(e) => setNewSlot({ ...newSlot, day: Number(e.target.value) })} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #444", background: "#0f0f1a", color: "#eee", fontSize: 12 }}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <select value={newSlot.hour} onChange={(e) => setNewSlot({ ...newSlot, hour: Number(e.target.value) })} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #444", background: "#0f0f1a", color: "#eee", fontSize: 12 }}>
                  {HOURS.map((h) => <option key={h} value={h}>{h}:00</option>)}
                </select>
                <input placeholder="Label" value={newSlot.label} onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #444", background: "#0f0f1a", color: "#eee", fontSize: 12, width: 100 }} />
                <button onClick={handleAddSlot} style={{ padding: "6px 14px", borderRadius: 4, border: "1px solid #e94560", background: "transparent", color: "#e94560", cursor: "pointer", fontSize: 12 }}>+ Add</button>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 12 }}>Upcoming Entries</h3>
              {entries.slice(0, 15).map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #2a2a3a", fontSize: 12 }}>
                  <span style={{ color: "#e94560", minWidth: 80 }}>{e.scheduled_date}</span>
                  <span style={{ color: "#aaa", flex: 1 }}>{e.slot_name || "Unscheduled"}</span>
                  {e.package_status && <span style={{ color: e.package_status === "APPROVED" ? "#4ade80" : "#fbbf24", fontSize: 11 }}>{e.package_status}</span>}
                  <button onClick={() => api.deleteCalendarEntry(e.id).then(() => loadData(selectedChannel!))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 12 }}>×</button>
                </div>
              ))}
              {entries.length === 0 && <p style={{ color: "#666", fontSize: 13 }}>No scheduled entries.</p>}
            </div>
          </div>
        </>
      )}

      {selectedChannel && tab === "batch" && (
        <div style={styles.card}>
          <h3 style={{ fontSize: 15, color: "#ccc", marginBottom: 16 }}>Batch Generate & Schedule</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
            <select style={styles.select} value={batchWorkflow} onChange={(e) => setBatchWorkflow(e.target.value)}>
              <option value="">Select Workflow...</option>
              {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <textarea
              placeholder="Enter topics, one per line&#10;Example:&#10;How AI is changing jobs&#10;Top 5 productivity tools&#10;Future of remote work"
              value={batchTopics}
              onChange={(e) => setBatchTopics(e.target.value)}
              style={{ ...styles.select, minHeight: 140, resize: "vertical", fontFamily: "inherit" } as any}
              rows={5}
            />
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label style={{ color: "#888", fontSize: 13 }}>Start scheduling from day:</label>
              <input type="number" min={0} max={90} value={batchDays} onChange={(e) => setBatchDays(Number(e.target.value))} style={{ width: 60, padding: "6px 10px", borderRadius: 4, border: "1px solid #444", background: "#0f0f1a", color: "#eee", fontSize: 13 }} />
            </div>
            <button
              onClick={handleBatchGenerate}
              disabled={!batchWorkflow || !batchTopics.trim() || batchGenerating}
              style={{ ...styles.btn, opacity: !batchWorkflow || !batchTopics.trim() ? 0.5 : 1 }}
            >
              {batchGenerating ? "Generating... (this may take 1-2 minutes)" : `Generate & Schedule ${batchTopics.split("\n").filter(t => t.trim()).length || 0} Packages`}
            </button>
          </div>

          {batchResult && (
            <div style={{ marginTop: 20 }}>
              <p style={{ color: "#4ade80", fontWeight: 600 }}>Generated {batchResult.generated} packages!</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                {batchResult.results?.map((r: any, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: "#aaa", padding: "4px 0", borderBottom: "1px solid #2a2a3a" }}>
                    <span style={{ color: r.status === "APPROVED" ? "#4ade80" : "#fbbf24" }}>{r.status}</span>
                    {" "}{r.topic} (pkg #{r.package_id})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  select: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid #444",
    background: "#1e1e2e",
    color: "#eee",
    fontSize: 14,
    minWidth: 250,
  },
  card: {
    background: "#1e1e2e",
    borderRadius: 8,
    padding: "18px 22px",
    border: "1px solid #333",
  },
  tabBtn: {
    padding: "8px 18px",
    borderRadius: 6,
    border: "1px solid #333",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: 13,
  },
  tabActive: {
    background: "#16213e",
    color: "#e94560",
    borderColor: "#e94560",
  },
  navBtn: {
    padding: "6px 14px",
    borderRadius: 4,
    border: "1px solid #444",
    background: "#1e1e2e",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 12,
  },
  cellHeader: {
    padding: "8px 6px",
    background: "#1a1a2e",
    borderBottom: "1px solid #333",
    fontSize: 12,
    color: "#ccc",
  },
  cell: {
    padding: "3px 4px",
    minHeight: 28,
    borderBottom: "1px solid #1f1f30",
    fontSize: 10,
  },
  btn: {
    padding: "14px 24px",
    background: "#e94560",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  error: {
    marginBottom: 12,
    padding: 12,
    background: "rgba(233, 69, 96, 0.15)",
    border: "1px solid rgba(233, 69, 96, 0.3)",
    borderRadius: 6,
    color: "#ef9a9a",
    fontSize: 13,
  },
};

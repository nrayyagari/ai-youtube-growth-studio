import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/channels", label: "Channels" },
  { to: "/workflows", label: "Workflows" },
  { to: "/skills", label: "Skills" },
  { to: "/generate", label: "Generator" },
  { to: "/calendar", label: "Calendar" },
  { to: "/analytics", label: "Analytics" },
  { to: "/competitors", label: "Competitors" },
  { to: "/patterns", label: "Patterns" },
  { to: "/ab-test", label: "A/B Test" },
  { to: "/upload", label: "Upload" },
  { to: "/compare", label: "Compare" },
  { to: "/tts", label: "TTS" },
  { to: "/whisper", label: "Whisper" },
  { to: "/channel-analytics", label: "Ch. Stats" },
  { to: "/thumbnails", label: "Thumbnails" },
  { to: "/settings", label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside style={styles.aside}>
      <div style={styles.brand}>🎬 Growth Studio</div>
      <nav style={styles.nav}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.active : {}),
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  aside: {
    width: 220,
    minHeight: "100vh",
    background: "#1a1a2e",
    color: "#eee",
    padding: "20px 0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    padding: "0 20px 20px",
    borderBottom: "1px solid #333",
    marginBottom: 8,
  },
  nav: { display: "flex", flexDirection: "column", gap: 2 },
  link: {
    display: "block",
    padding: "10px 20px",
    color: "#aaa",
    textDecoration: "none",
    fontSize: 14,
    borderRadius: 0,
    transition: "background 0.15s",
  },
  active: { background: "#16213e", color: "#fff", borderRight: "3px solid #e94560" },
};

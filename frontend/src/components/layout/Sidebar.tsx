import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const links = [
  { to: "/generate", label: "Generate" },
  { to: "/my-videos", label: "My Scripts" },
  { to: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside style={styles.aside}>
      <div style={styles.brand}>🎬 Growth Studio</div>
      {user && (
        <div style={styles.userBanner}>
          <span style={styles.tierBadge}>{user.subscription_tier.toUpperCase()}</span>
          <span style={styles.usage}>
            {user.usage ? `${user.usage.packages_this_month.used}/${user.usage.packages_this_month.limit ?? "∞"}` : ""}
          </span>
        </div>
      )}
      <nav style={styles.nav}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/my-videos"}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.active : {}),
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div style={styles.footer}>
        <Link to="/pricing" style={styles.footerLink}>Upgrade</Link>
        <Link to="/" style={styles.footerLink}>Home</Link>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  aside: {
    width: 220, minHeight: "100vh", background: "#1a1a2e", color: "#eee",
    padding: "20px 0", display: "flex", flexDirection: "column", gap: 8,
  },
  brand: { fontSize: 18, fontWeight: 700, padding: "0 20px 20px", borderBottom: "1px solid #333", marginBottom: 0 },
  userBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid #333", marginBottom: 8 },
  tierBadge: { fontSize: 11, fontWeight: 800, color: "#e94560", background: "rgba(233,69,96,0.15)", padding: "3px 8px", borderRadius: 4 },
  usage: { fontSize: 12, color: "#888" },
  nav: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  link: { display: "block", padding: "10px 20px", color: "#aaa", textDecoration: "none", fontSize: 14, transition: "background 0.15s" },
  active: { background: "#16213e", color: "#fff", borderRight: "3px solid #e94560" },
  footer: { display: "flex", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #333", marginTop: 8 },
  footerLink: { color: "#777", textDecoration: "none", fontSize: 13 },
};

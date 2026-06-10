import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const links = [
  { to: "/generate", label: "Generate" },
  { to: "/my-videos", label: "My Scripts" },
  { to: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const { isAuthenticated, logout, email } = useAuth();

  return (
    <aside style={styles.aside}>
      <div style={styles.brand}>Growth Studio</div>
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
        {isAuthenticated ? (
          <>
            <span style={styles.email}>{email}</span>
            <button onClick={logout} style={styles.logoutBtn}>Logout</button>
          </>
        ) : (
          <NavLink to="/login" style={styles.loginBtn}>Sign in</NavLink>
        )}
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
  nav: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  link: { display: "block", padding: "10px 20px", color: "#aaa", textDecoration: "none", fontSize: 14, transition: "background 0.15s" },
  active: { background: "#16213e", color: "#fff", borderRight: "3px solid #e94560" },
  footer: { display: "flex", flexDirection: "column", gap: 4, padding: "12px 20px", borderTop: "1px solid #333", marginTop: 8 },
  email: { color: "#777", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" },
  logoutBtn: { color: "#e94560", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left", padding: 0 },
  loginBtn: { color: "#e94560", textDecoration: "none", fontSize: 13, fontWeight: 600 },
};

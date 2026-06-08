import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f0f1a", color: "#e0e0e0" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

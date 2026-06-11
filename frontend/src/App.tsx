import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Generator from "./pages/Generator";
import MyVideos from "./pages/MyVideos";
import PackageDetail from "./pages/PackageDetail";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import DriveCallback from "./pages/DriveCallback";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { StorageProvider } from "./contexts/StorageContext";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f1a", color: "#b8b8c9" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/drive/callback" element={<DriveCallback />} />
      <Route element={<RequireAuth><ErrorBoundary><Layout /></ErrorBoundary></RequireAuth>}>
        <Route path="/generate" element={<Generator />} />
        <Route path="/my-videos" element={<MyVideos />} />
        <Route path="/packages/:id" element={<PackageDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StorageProvider>
          <AppRoutes />
        </StorageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

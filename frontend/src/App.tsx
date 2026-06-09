import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Generator from "./pages/Generator";
import MyVideos from "./pages/MyVideos";
import PackageDetail from "./pages/PackageDetail";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import AuthRedirect from "./pages/AuthRedirect";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f1a", color: "#ccc" }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<AuthRedirect mode="login" />} />
      <Route path="/signup" element={<AuthRedirect mode="signup" />} />
      <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
        <Route path="/generate" element={<ProtectedRoute><Generator /></ProtectedRoute>} />
        <Route path="/my-videos" element={<ProtectedRoute><MyVideos /></ProtectedRoute>} />
        <Route path="/packages/:id" element={<ProtectedRoute><PackageDetail /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

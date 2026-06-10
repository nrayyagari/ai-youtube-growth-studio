import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Generator from "./pages/Generator";
import MyVideos from "./pages/MyVideos";
import PackageDetail from "./pages/PackageDetail";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { StorageProvider } from "./contexts/StorageContext";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
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

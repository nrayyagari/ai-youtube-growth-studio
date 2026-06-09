import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Channels from "./pages/Channels";
import Workflows from "./pages/Workflows";
import Skills from "./pages/Skills";
import Generator from "./pages/Generator";
import PackageDetail from "./pages/PackageDetail";
import Settings from "./pages/Settings";
import ReferenceVideos from "./pages/ReferenceVideos";
import StyleProfiles from "./pages/StyleProfiles";
import SeriesPlanner from "./pages/SeriesPlanner";
import Analytics from "./pages/Analytics";
import ContentCalendar from "./pages/ContentCalendar";
import CompetitorAnalysis from "./pages/CompetitorAnalysis";
import PatternLibrary from "./pages/PatternLibrary";
import ABTestPage from "./pages/ABTestPage";
import YouTubeUpload from "./pages/YouTubeUpload";
import PackageCompare from "./pages/PackageCompare";
import TTSPage from "./pages/TTSPage";
import WhisperPage from "./pages/WhisperPage";
import ChannelAnalytics from "./pages/ChannelAnalytics";
import ThumbnailGenerator from "./pages/ThumbnailGenerator";
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
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/channels" element={<ProtectedRoute><Channels /></ProtectedRoute>} />
        <Route path="/channels/:channelId/reference-videos" element={<ProtectedRoute><ReferenceVideos /></ProtectedRoute>} />
        <Route path="/channels/:channelId/style-profiles" element={<ProtectedRoute><StyleProfiles /></ProtectedRoute>} />
        <Route path="/channels/:channelId/series" element={<ProtectedRoute><SeriesPlanner /></ProtectedRoute>} />
        <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><Skills /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><Generator /></ProtectedRoute>} />
        <Route path="/packages/:id" element={<ProtectedRoute><PackageDetail /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><ContentCalendar /></ProtectedRoute>} />
        <Route path="/competitors" element={<ProtectedRoute><CompetitorAnalysis /></ProtectedRoute>} />
        <Route path="/patterns" element={<ProtectedRoute><PatternLibrary /></ProtectedRoute>} />
        <Route path="/ab-test" element={<ProtectedRoute><ABTestPage /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><YouTubeUpload /></ProtectedRoute>} />
        <Route path="/compare" element={<ProtectedRoute><PackageCompare /></ProtectedRoute>} />
        <Route path="/tts" element={<ProtectedRoute><TTSPage /></ProtectedRoute>} />
        <Route path="/whisper" element={<ProtectedRoute><WhisperPage /></ProtectedRoute>} />
        <Route path="/channel-analytics" element={<ProtectedRoute><ChannelAnalytics /></ProtectedRoute>} />
        <Route path="/thumbnails" element={<ProtectedRoute><ThumbnailGenerator /></ProtectedRoute>} />
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

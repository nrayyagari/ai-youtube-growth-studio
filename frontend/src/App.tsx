import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<AuthRedirect mode="login" />} />
        <Route path="/signup" element={<AuthRedirect mode="signup" />} />
        <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/channels/:channelId/reference-videos" element={<ReferenceVideos />} />
          <Route path="/channels/:channelId/style-profiles" element={<StyleProfiles />} />
          <Route path="/channels/:channelId/series" element={<SeriesPlanner />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/generate" element={<Generator />} />
          <Route path="/packages/:id" element={<PackageDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/calendar" element={<ContentCalendar />} />
          <Route path="/competitors" element={<CompetitorAnalysis />} />
          <Route path="/patterns" element={<PatternLibrary />} />
          <Route path="/ab-test" element={<ABTestPage />} />
          <Route path="/upload" element={<YouTubeUpload />} />
          <Route path="/compare" element={<PackageCompare />} />
          <Route path="/tts" element={<TTSPage />} />
          <Route path="/whisper" element={<WhisperPage />} />
          <Route path="/channel-analytics" element={<ChannelAnalytics />} />
          <Route path="/thumbnails" element={<ThumbnailGenerator />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

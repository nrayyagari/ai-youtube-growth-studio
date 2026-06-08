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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/channels/:channelId/reference-videos" element={<ReferenceVideos />} />
          <Route path="/channels/:channelId/style-profiles" element={<StyleProfiles />} />
          <Route path="/channels/:channelId/series" element={<SeriesPlanner />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/generate" element={<Generator />} />
          <Route path="/packages/:id" element={<PackageDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

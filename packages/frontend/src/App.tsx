import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.tsx";
import { ProjectsPage } from "./pages/ProjectsPage.tsx";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.tsx";
import { EmbedsPage } from "./pages/EmbedsPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { ServerPage } from "./pages/ServerPage.tsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/server" element={<ServerPage />} />
        <Route path="/embeds" element={<EmbedsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

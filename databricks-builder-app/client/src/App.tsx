import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { UserProvider } from "./contexts/UserContext";
import { ProjectsProvider } from "./contexts/ProjectsContext";
import VsaDashboard from "./pages/vsa/VsaDashboard";
import VsaInbox from "./pages/vsa/VsaInbox";
import VsaTaskList from "./pages/vsa/VsaTaskList";
import VsaTaskDetail from "./pages/vsa/VsaTaskDetail";
import VsaProducts from "./pages/vsa/VsaProducts";
import VsaCustomers from "./pages/vsa/VsaCustomers";
import VsaTemplates from "./pages/vsa/VsaTemplates";

function App() {
  return (
    <UserProvider>
      <ProjectsProvider>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<Navigate to="/vsa" replace />} />
            <Route path="/vsa" element={<VsaDashboard />} />
            <Route path="/vsa/emails" element={<VsaInbox />} />
            <Route path="/vsa/tasks" element={<VsaTaskList />} />
            <Route path="/vsa/tasks/:id" element={<VsaTaskDetail />} />
            <Route path="/vsa/products" element={<VsaProducts />} />
            <Route path="/vsa/customers" element={<VsaCustomers />} />
            <Route path="/vsa/templates" element={<VsaTemplates />} />
            <Route path="*" element={<Navigate to="/vsa" replace />} />
          </Routes>
          <Toaster position="bottom-right" />
        </div>
      </ProjectsProvider>
    </UserProvider>
  );
}

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import RequireAuth from "./components/auth/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Gallery from "./pages/Gallery";
import PrivateGallery from "./pages/PrivateGallery";
import People from "./pages/People";
import UploadCenter from "./pages/UploadCenter";
import Deliveries from "./pages/Deliveries";
import AIAssistant from "./pages/AIAssistant";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/private-gallery" element={<PrivateGallery />} />
              <Route path="/people" element={<People />} />
              <Route path="/upload" element={<UploadCenter />} />
              <Route path="/deliveries" element={<Deliveries />} />
              <Route path="/assistant" element={<AIAssistant />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

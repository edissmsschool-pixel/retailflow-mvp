import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { IdleLock } from "@/components/IdleLock";

import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Shifts from "./pages/Shifts";
import Staff from "./pages/Staff";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors position="top-right" />
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthProvider>
          <IdleLock />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<ProtectedRoute requireRole={["admin", "manager"]}><Dashboard /></ProtectedRoute>} />
              <Route path="/pos" element={<POS />} />
              <Route path="/products" element={<ProtectedRoute requireRole={["admin", "manager"]}><Products /></ProtectedRoute>} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/reports" element={<ProtectedRoute requireRole={["admin", "manager"]}><Reports /></ProtectedRoute>} />
              <Route path="/shifts" element={<Shifts />} />
              <Route path="/staff" element={<ProtectedRoute requireRole="admin"><Staff /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requireRole="admin"><Settings /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

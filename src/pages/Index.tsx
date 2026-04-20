import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Default landing: managers/admins see Dashboard, cashiers go straight to POS. */
export default function Index() {
  const { isManagerOrAdmin, loading } = useAuth();
  if (loading) return null;
  if (isManagerOrAdmin) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/pos" replace />;
}

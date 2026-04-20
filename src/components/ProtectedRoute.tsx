import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: AppRole | AppRole[];
}) {
  const { session, loading, roles } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;

  if (requireRole) {
    const required = Array.isArray(requireRole) ? requireRole : [requireRole];
    const ok = required.some((r) => roles.includes(r));
    if (!ok) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

import { Navigate, useLocation } from "react-router-dom";
import { forwardRef, ReactNode } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: AppRole | AppRole[];
}

/**
 * forwardRef wrapper so React Router (which forwards refs into route elements)
 * does not warn about passing a ref to a function component.
 */
export const ProtectedRoute = forwardRef<HTMLDivElement, ProtectedRouteProps>(
  function ProtectedRoute({ children, requireRole }, _ref) {
    const { session, loading, roles } = useAuth();
    const location = useLocation();

    if (loading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (!session) {
      return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (requireRole) {
      const required = Array.isArray(requireRole) ? requireRole : [requireRole];
      const ok = required.some((r) => roles.includes(r));
      if (!ok) return <Navigate to="/" replace />;
    }

    return <>{children}</>;
  }
);

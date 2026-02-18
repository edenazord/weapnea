
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileRole = 'company' | 'instructor' | 'final_user' | 'admin' | 'blogger' | 'creator';

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles: Array<ProfileRole>;
};

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="w-full max-w-md p-8 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-12 w-full mt-4" />
            </div>
        </div>
    );
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

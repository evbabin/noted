import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { tokenStorage } from '../../api/client';

interface ProtectedRouteProps {
  redirectTo?: string;
}

export function ProtectedRoute({ redirectTo = '/login' }: ProtectedRouteProps) {
  const location = useLocation();
  const isAuthenticated = Boolean(tokenStorage.getAccess());

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;

/**
 * Route guard.
 *
 * This only decides what to *render*. Authorization is enforced by the API on
 * every request; a determined user who edits their bundle still gets 403s.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LoadingState } from '../components/common/states';

export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="login-shell">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // Remember where they were headed so sign-in returns them there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

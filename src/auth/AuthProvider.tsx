/**
 * Authentication state for the whole app.
 *
 * The signed-in identity, and crucially the *role*, always come from
 * `GET /api/me` - i.e. from the User document in MongoDB - never from decoding
 * the token in the browser. The token proves who you are; the server decides
 * what you may do, on every single request.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { BootstrapInput, ChangePasswordInput, CurrentUserDto } from '@hostel/shared';
import { authApi, meApi } from '../api/resources';
import { ApiClientError, setUnauthorizedHandler } from '../api/client';
import { clearSession, getToken, setSession } from './session';

/**
 * `bootstrap` means the database has no users at all, so the first visitor is
 * invited to create the owner account instead of being asked to sign in.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'bootstrap';

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUserDto | null;
  /** The hostel name, available before sign-in so the login screen can show it. */
  hostelName: string;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  createFirstOwner: (input: BootstrapInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [hostelName, setHostelName] = useState('Hostel Manager');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Ask the API who we are. This is the only source of the role. */
  const loadIdentity = useCallback(async (): Promise<boolean> => {
    try {
      const me = await meApi.get();
      if (!mounted.current) return true;
      setUser(me);
      setStatus('authenticated');
      return true;
    } catch {
      if (!mounted.current) return false;
      setUser(null);
      clearSession();
      setStatus('unauthenticated');
      return false;
    }
  }, []);

  /** Is there anybody to sign in as yet? */
  const loadStatus = useCallback(async () => {
    try {
      const info = await authApi.status();
      if (!mounted.current) return;
      setHostelName(info.hostelName);
      setStatus(info.needsBootstrap ? 'bootstrap' : 'unauthenticated');
    } catch {
      // The API is unreachable. Show the login form rather than a blank screen;
      // the attempt will surface a proper error message.
      if (mounted.current) setStatus('unauthenticated');
    }
  }, []);

  // Bootstrap: if a token is already held, verify it; otherwise ask whether the
  // instance needs its first owner.
  useEffect(() => {
    void (async () => {
      if (getToken()) {
        const ok = await loadIdentity();
        if (ok) return;
      }
      await loadStatus();
    })();
  }, [loadIdentity, loadStatus]);

  // A 401 from any request drops us back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!mounted.current) return;
      clearSession();
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  const asMessage = (err: unknown, fallback: string): string =>
    err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : fallback;

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const result = await authApi.login({ email, password });
        setSession(result.token, result.expiresAt);
        setUser(result.user);
        setStatus('authenticated');
      } catch (err) {
        clearSession();
        setError(asMessage(err, 'Could not sign in.'));
        setStatus('unauthenticated');
        throw err;
      }
    },
    [],
  );

  const createFirstOwner = useCallback(async (input: BootstrapInput) => {
    setError(null);
    try {
      const result = await authApi.bootstrap(input);
      setSession(result.token, result.expiresAt);
      setUser(result.user);
      setHostelName(input.hostelName?.trim() || 'Hostel Manager');
      setStatus('authenticated');
    } catch (err) {
      setError(asMessage(err, 'Could not create the owner account.'));
      throw err;
    }
  }, []);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    setError(null);
    try {
      // The server ends every other session and hands back a fresh token, so
      // the tab that made the change stays signed in.
      const result = await authApi.changePassword(input);
      setSession(result.token, result.expiresAt);
      setUser(result.user);
      setStatus('authenticated');
    } catch (err) {
      setError(asMessage(err, 'Could not change the password.'));
      throw err;
    }
  }, []);

  const signOut = useCallback(() => {
    // Fire and forget: clearing the cookie server-side is a courtesy, and the
    // local session must go regardless of whether the request succeeds.
    void authApi.logout().catch(() => undefined);
    clearSession();
    setUser(null);
    setError(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      hostelName,
      error,
      signIn,
      createFirstOwner,
      changePassword,
      signOut,
      refresh: async () => {
        await loadIdentity();
      },
      clearError: () => setError(null),
    }),
    [status, user, hostelName, error, signIn, createFirstOwner, changePassword, signOut, loadIdentity],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/**
 * Permission helpers, read from the server-supplied flags.
 * These only hide UI. Every one is enforced again in the API.
 */
export function usePermissions(): CurrentUserDto['permissions'] {
  const { user } = useAuth();
  return (
    user?.permissions ?? {
      canRead: false,
      canRecordTransactions: false,
      canManageRecords: false,
      canAdminister: false,
      canViewActivityLog: false,
      canViewDiagnostics: false,
    }
  );
}

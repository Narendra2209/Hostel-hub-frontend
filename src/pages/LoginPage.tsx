/**
 * Sign in, and first-run setup.
 *
 * Three states, driven by the server:
 *   - `bootstrap`  the database has no users yet, so create the first OWNER
 *   - sign in      the ordinary case
 *   - change password  forced when an invited account still holds its temporary one
 *
 * Nothing on this screen touches hostel data. It only obtains a session; the
 * API decides what that account may then see.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { bootstrapSchema, changePasswordSchema, loginSchema } from '@hostel/shared';
import { Button } from '../components/common/Button';
import { FormError, FormField } from '../components/common/FormField';
import { LoadingState } from '../components/common/states';
import { useAuth } from '../auth/AuthProvider';

interface LocationState {
  from?: { pathname: string; search: string };
}

/** Turn a Zod failure into the field-keyed messages FormField expects. */
function fieldErrors(result: { success: false; error: { issues: { path: (string | number)[]; message: string }[] } }) {
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_');
    errors[key] ??= issue.message;
  }
  return errors;
}

export function LoginPage(): JSX.Element {
  const { status, user, hostelName, signIn, createFirstOwner, changePassword, error, clearError } =
    useAuth();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [hostel, setHostel] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clearError();
    // Only on mount; clearing on every render would erase the message to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return (
      <div className="login-shell">
        <LoadingState label="Getting things ready…" />
      </div>
    );
  }

  // Signed in and nothing outstanding - go where they were headed.
  if (status === 'authenticated' && user && !user.mustChangePassword) {
    const state = location.state as LocationState | null;
    const to = state?.from ? `${state.from.pathname}${state.from.search}` : '/';
    return <Navigate to={to} replace />;
  }

  const run = async (validate: () => boolean, action: () => Promise<void>) => {
    setErrors({});
    if (!validate()) return;
    setSubmitting(true);
    try {
      await action();
    } catch {
      // The provider has already put a readable message on `error`.
    } finally {
      setSubmitting(false);
    }
  };

  const onSignIn = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => {
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed));
          return false;
        }
        return true;
      },
      () => signIn(email, password),
    );
  };

  const onBootstrap = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => {
        const parsed = bootstrapSchema.safeParse({
          name,
          email,
          password,
          hostelName: hostel.trim() || undefined,
        });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed));
          return false;
        }
        return true;
      },
      () =>
        createFirstOwner({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          ...(hostel.trim() ? { hostelName: hostel.trim() } : {}),
        }),
    );
  };

  const onChangePassword = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => {
        const parsed = changePasswordSchema.safeParse({
          currentPassword,
          newPassword,
          confirmPassword,
        });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed));
          return false;
        }
        return true;
      },
      () => changePassword({ currentPassword, newPassword, confirmPassword }),
    );
  };

  const banner = error ?? errors._;

  /* ---------- forced password change ---------- */
  if (status === 'authenticated' && user?.mustChangePassword) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-block">
            <div className="mark">{hostelName}</div>
            <div className="sub">Fees &amp; running costs</div>
          </div>
          <form className="card" onSubmit={onChangePassword}>
            <div className="card-h">
              <h2>Choose a new password</h2>
            </div>
            <p className="hint" style={{ padding: '12px 16px 0', margin: 0 }}>
              This account is still using the temporary password it was created with. Set a
              permanent one to continue.
            </p>
            <FormError message={banner} />
            <div className="formgrid">
              <FormField label="Temporary password" error={errors.currentPassword}>
                {(props) => (
                  <input
                    {...props}
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                )}
              </FormField>
              <FormField
                label="New password"
                error={errors.newPassword}
                hint="At least 10 characters, with an uppercase letter, a lowercase letter and a digit"
              >
                {(props) => (
                  <input
                    {...props}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Confirm new password" error={errors.confirmPassword}>
                {(props) => (
                  <input
                    {...props}
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                )}
              </FormField>
              <div className="actions">
                <Button type="submit" loading={submitting}>
                  Set password and continue
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ---------- first-run owner setup ---------- */
  if (status === 'bootstrap') {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-block">
            <div className="mark">Hostel Manager</div>
            <div className="sub">First-time setup</div>
          </div>
          <form className="card" onSubmit={onBootstrap}>
            <div className="card-h">
              <h2>Create the owner account</h2>
            </div>
            <p className="hint" style={{ padding: '12px 16px 0', margin: 0 }}>
              This database has no users yet. The account you create now becomes the owner and can
              invite everyone else.
            </p>
            <FormError message={banner} />
            <div className="formgrid">
              <FormField label="Your name" error={errors.name}>
                {(props) => (
                  <input
                    {...props}
                    autoComplete="name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Email address" error={errors.email}>
                {(props) => (
                  <input
                    {...props}
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </FormField>
              <FormField
                label="Password"
                error={errors.password}
                hint="At least 10 characters, with an uppercase letter, a lowercase letter and a digit"
              >
                {(props) => (
                  <input
                    {...props}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Hostel name (optional)" error={errors.hostelName}>
                {(props) => (
                  <input
                    {...props}
                    value={hostel}
                    placeholder="Hostel Manager"
                    onChange={(e) => setHostel(e.target.value)}
                  />
                )}
              </FormField>
              <div className="actions">
                <Button type="submit" loading={submitting}>
                  Create account
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ---------- ordinary sign in ---------- */
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-block">
          <div className="mark">{hostelName}</div>
          <div className="sub">Fees &amp; running costs</div>
        </div>
        <form className="card" onSubmit={onSignIn}>
          <div className="card-h">
            <h2>Sign in</h2>
          </div>
          <FormError message={banner} />
          <div className="formgrid">
            <FormField label="Email address" error={errors.email}>
              {(props) => (
                <input
                  {...props}
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Password" error={errors.password}>
              {(props) => (
                <input
                  {...props}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </FormField>
            <div className="actions">
              <Button type="submit" loading={submitting}>
                Sign in
              </Button>
            </div>
          </div>
        </form>
        <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
          Forgotten your password? Ask an owner to reset it from Settings.
        </p>
      </div>
    </div>
  );
}

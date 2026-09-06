/**
 * Staff accounts.
 *
 * Only an owner sees this card. Everything it does is re-authorised on the
 * server: hiding a button here is a convenience, not a control.
 */
import { useState } from 'react';
import {
  ROLE_DESCRIPTIONS,
  USER_ROLES,
  formatDateLabel,
  type UserRole,
} from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, TableScroll } from '../common/Card';
import { Modal } from '../common/Modal';
import { FormError, FormField } from '../common/FormField';
import { EmptyState, TableSkeleton, errorMessage, QueryBoundary } from '../common/states';
import { useToast } from '../common/ToastProvider';
import { useConfirm } from '../common/ConfirmProvider';
import { useAuth, usePermissions } from '../../auth/AuthProvider';
import { useInviteUser, useResetUserPassword, useUpdateUser, useUsers } from '../../hooks/useUsers';


export function UsersCard(): JSX.Element | null {
  const { canAdminister } = usePermissions();
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const usersQuery = useUsers({ pageSize: 50 });
  const invite = useInviteUser();
  const update = useUpdateUser();
  const resetPassword = useResetUserPassword();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('VIEWER');
  const [formError, setFormError] = useState<string | null>(null);
  /** Shown once after an invite or a reset; never persisted anywhere. */
  const [oneTimePassword, setOneTimePassword] = useState<{ email: string; password: string } | null>(
    null,
  );

  // The API refuses this too; the card simply does not render for anyone else.
  if (!canAdminister) return null;

  const users = usersQuery.data?.items ?? [];

  const onInvite = async () => {
    setFormError(null);
    try {
      const result = await invite.mutateAsync({ name: name.trim(), email: email.trim(), role });
      setOneTimePassword({ email: result.user.email, password: result.temporaryPassword });
      setInviteOpen(false);
      setName('');
      setEmail('');
      setRole('VIEWER');
      toast.success(`${result.user.name} can now sign in.`);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const onChangeRole = async (id: string, nextRole: UserRole) => {
    try {
      await update.mutateAsync({ id, role: nextRole });
      toast.success('Role updated.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onToggleActive = async (id: string, name: string, active: boolean) => {
    const ok = await confirm({
      title: active ? `Deactivate ${name}?` : `Reactivate ${name}?`,
      message: active
        ? 'They will be signed out immediately and will not be able to sign back in.'
        : 'They will be able to sign in again with their existing password.',
      confirmLabel: active ? 'Deactivate' : 'Reactivate',
      tone: active ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      await update.mutateAsync({ id, active: !active });
      toast.success(active ? 'Account deactivated.' : 'Account reactivated.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onResetPassword = async (id: string, name: string, email: string) => {
    const ok = await confirm({
      title: `Reset ${name}'s password?`,
      message:
        'A new temporary password will be generated and shown once. Their current password stops working and any open session ends.',
      confirmLabel: 'Reset password',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const result = await resetPassword.mutateAsync({ id });
      setOneTimePassword({ email, password: result.temporaryPassword });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <Card
        title="Staff accounts"
        hint={`${users.length} ${users.length === 1 ? 'account' : 'accounts'}`}
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            Invite someone
          </Button>
        }
      >
        <QueryBoundary
          isLoading={usersQuery.isLoading}
          error={usersQuery.error}
          onRetry={() => void usersQuery.refetch()}
          isEmpty={users.length === 0}
          skeleton={<TableSkeleton rows={3} columns={4} />}
          empty={<EmptyState title="No accounts yet" message="Invite a colleague to get started." />}
          errorTitle="Could not load accounts"
        >
          <TableScroll>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Last signed in</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isMe = user.id === me?.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="name">
                          {user.name}
                          {isMe ? <span className="sub"> (you)</span> : null}
                        </div>
                        <div className="sub">{user.email}</div>
                      </td>
                      <td>
                        <select
                          value={user.role}
                          onChange={(event) =>
                            void onChangeRole(user.id, event.target.value as UserRole)
                          }
                          disabled={!user.active}
                          style={{ width: 'auto', padding: '4px 6px' }}
                          aria-label={`Role for ${user.name}`}
                          title={ROLE_DESCRIPTIONS[user.role]}
                        >
                          {USER_ROLES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="sub num">
                        {user.lastLoginAt ? formatDateLabel(user.lastLoginAt.slice(0, 10)) : 'never'}
                        {user.mustChangePassword ? (
                          <div>
                            <span className="chip part">Temporary password</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="r">
                        <div className="inline-actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void onResetPassword(user.id, user.name, user.email)}
                          >
                            Reset password
                          </Button>
                          <Button
                            size="sm"
                            variant={user.active ? 'danger' : 'ghost'}
                            onClick={() => void onToggleActive(user.id, user.name, user.active)}
                          >
                            {user.active ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </QueryBoundary>
      </Card>

      <Modal
        open={inviteOpen}
        title="Invite someone"
        onClose={() => setInviteOpen(false)}
        busy={invite.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void onInvite()} loading={invite.isPending}>
              Create account
            </Button>
          </>
        }
      >
        <FormError message={formError} />
        <div style={{ display: 'grid', gap: 12 }}>
          <FormField label="Name">
            {(props) => (
              <input {...props} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            )}
          </FormField>
          <FormField label="Email address">
            {(props) => (
              <input
                {...props}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Role" hint={ROLE_DESCRIPTIONS[role]}>
            {(props) => (
              <select {...props} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {USER_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <p className="hint" style={{ margin: 0 }}>
            A temporary password is generated and shown to you once. Pass it on securely; they will
            be asked to choose their own the first time they sign in.
          </p>
        </div>
      </Modal>

      <Modal
        open={oneTimePassword !== null}
        title="Temporary password"
        onClose={() => setOneTimePassword(null)}
        footer={
          <Button onClick={() => setOneTimePassword(null)}>Done</Button>
        }
      >
        <p style={{ marginTop: 0 }}>
          Give this to <strong>{oneTimePassword?.email}</strong>. It is shown only once and cannot
          be retrieved later — reset the password again if it is lost.
        </p>
        <div
          className="num"
          style={{
            fontSize: 19,
            fontWeight: 600,
            padding: '12px 14px',
            background: '#F7FAFB',
            border: '1px solid var(--rule)',
            borderRadius: 8,
            userSelect: 'all',
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}
        >
          {oneTimePassword?.password}
        </div>
      </Modal>
    </>
  );
}

/**
 * Staff accounts and their roles.
 *
 * Roles are enforced by the API on every request; these hooks only drive the
 * Settings screen. An owner is the only role that can invite, change a role, or
 * reset a password.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InviteUserInput, UserDto, UserRole } from '@hostel/shared';
import { usersApi } from '../api/resources';
import { queryKeys } from '../api/queryKeys';

export function useUsers(params: { page?: number; pageSize?: number; search?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.list(params),
    staleTime: 30_000,
  });
}

function useUserMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      // A role change alters what the signed-in user may do, so refresh identity.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

/** Returns the one-time temporary password; show it once, never store it. */
export const useInviteUser = () =>
  useUserMutation((input: InviteUserInput) => usersApi.invite(input));

export const useUpdateUser = () =>
  useUserMutation((variables: { id: string; name?: string; role?: UserRole; active?: boolean }) => {
    const { id, ...patch } = variables;
    return usersApi.update(id, patch);
  });

export const useResetUserPassword = () =>
  useUserMutation((variables: { id: string; newPassword?: string }) =>
    usersApi.resetPassword(variables.id, { ...(variables.newPassword ? { newPassword: variables.newPassword } : {}) }),
  );

export type { UserDto };

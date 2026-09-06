/**
 * The DEVELOPER role's two read-only views: the activity log and diagnostics.
 *
 * Neither is scoped by the global month/building pickers. The activity log is
 * the audit trail rendered for people - it spans every month and every building
 * by definition - and diagnostics describe the server, not the register.
 *
 * Both endpoints are permission-gated in the API. `enabled` lets a screen skip
 * a request it already knows will be refused, so a MANAGER who types the URL
 * gets the standard error panel instead of a pointless 403 round trip.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ActivityEntryDto, ActivityListMeta, DiagnosticsDto } from '@hostel/shared';
import type { Paged } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { activityApi, diagnosticsApi, type ActivityListParams } from '../api/activity.api';

export type ActivityListResult = Paged<ActivityEntryDto, ActivityListMeta>;

export interface ActivityQueryOptions {
  enabled?: boolean;
}

/**
 * One page of "who changed what", newest first unless the caller says otherwise.
 *
 * The rows and `meta.filters` arrive together, so the filter selects are always
 * describing the same log the table is showing.
 */
export function useActivity(
  params: ActivityListParams,
  options: ActivityQueryOptions = {},
): UseQueryResult<ActivityListResult> {
  return useQuery({
    queryKey: queryKeys.activity.list({ ...params }),
    queryFn: () => activityApi.list(params),
    enabled: options.enabled ?? true,
    // The log only ever grows, and a stale page is misleading on a screen whose
    // whole point is "what just happened".
    staleTime: 15_000,
  });
}

/** How often the diagnostics snapshot refreshes while the screen is open. */
export const DIAGNOSTICS_REFRESH_MS = 15_000;

/**
 * A live snapshot of database, runtime, cache and timing health.
 *
 * React Query only runs `refetchInterval` while an observer is mounted, so the
 * polling starts when the screen opens and stops the moment it is left. It is
 * deliberately not refetched in a background tab either: nobody is reading it.
 */
export function useDiagnostics(
  options: ActivityQueryOptions = {},
): UseQueryResult<DiagnosticsDto> {
  return useQuery({
    queryKey: queryKeys.diagnostics.snapshot(),
    queryFn: () => diagnosticsApi.get(),
    enabled: options.enabled ?? true,
    refetchInterval: DIAGNOSTICS_REFRESH_MS,
    refetchIntervalInBackground: false,
    // Every reading is a measurement of this instant; none of them keep.
    staleTime: 0,
    gcTime: 60_000,
  });
}

/**
 * Arrears queries.
 *
 * Overdue money is not a property of one month - it is everything that was
 * billed, has passed its due date and is still unpaid - so these queries
 * deliberately ignore the global month picker. The only scope that applies is
 * the building filter plus the screen's own search / sort / pagination state.
 *
 * One endpoint serves both shapes: `groupBy=month` returns the reference
 * table's one-row-per-unpaid-month view, `groupBy=resident` rolls the same set
 * up per person. Both carry the identical `meta.totals`, which is what the
 * three stat cards render - the browser never adds a column up itself.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { OverdueResidentDto, OverdueResponseMeta, OverdueRowDto } from '@hostel/shared';
import type { Paged } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { overdueApi, type OverdueParams } from '../api/resources';

export type OverdueByMonthResult = Paged<OverdueRowDto, OverdueResponseMeta>;
export type OverdueByResidentResult = Paged<OverdueResidentDto, OverdueResponseMeta>;

export interface OverdueQueryOptions {
  /**
   * The screen keeps both hooks mounted and runs only the view on show, so
   * toggling the grouping never leaves a stale table behind.
   */
  enabled?: boolean;
}

/** Every unpaid billing month past its due date, newest arrears first. */
export function useOverdueByMonth(
  params: OverdueParams,
  options: OverdueQueryOptions = {},
): UseQueryResult<OverdueByMonthResult> {
  return useQuery({
    queryKey: queryKeys.overdue.list({ ...params, groupBy: 'month' }),
    queryFn: () => overdueApi.byMonth(params),
    enabled: options.enabled ?? true,
  });
}

/** The same arrears rolled up to one row per resident. */
export function useOverdueByResident(
  params: OverdueParams,
  options: OverdueQueryOptions = {},
): UseQueryResult<OverdueByResidentResult> {
  return useQuery({
    queryKey: queryKeys.overdue.list({ ...params, groupBy: 'resident' }),
    queryFn: () => overdueApi.byResident(params),
    enabled: options.enabled ?? true,
  });
}

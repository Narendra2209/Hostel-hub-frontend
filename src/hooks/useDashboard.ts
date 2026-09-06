/**
 * The Overview screen's one and only request.
 *
 * `GET /api/dashboard` returns every figure the screen shows - the six headline
 * tiles, the building-by-building table, who owes money, the Jan-Dec fee cards,
 * the bills breakdown and the salary run - already totalled by the backend. The
 * client never issues a second call per resident for the fee strips, and never
 * re-adds a number the payload already carries.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { DashboardDto } from '@hostel/shared';
import { queryKeys } from '../api/queryKeys';
import { dashboardApi } from '../api/resources';
import { useFilters } from './useFilters';

/** How many residents the fee-card table shows, matching the reference UI. */
export const FEE_STRIP_LIMIT = 15;

/**
 * What every Overview panel needs: the payload plus the three states it has to
 * be able to render on its own.
 */
export interface DashboardPanelProps {
  dashboard: DashboardDto | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function useDashboard(): UseQueryResult<DashboardDto, Error> {
  const { month, buildingId, year } = useFilters();

  return useQuery<DashboardDto, Error>({
    queryKey: queryKeys.dashboard.view({ month, buildingId, year, stripLimit: FEE_STRIP_LIMIT }),
    queryFn: () => dashboardApi.get({ month, buildingId, year, stripLimit: FEE_STRIP_LIMIT }),
    staleTime: 30_000,
  });
}

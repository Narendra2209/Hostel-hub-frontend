/**
 * The Profit & loss report.
 *
 * One request serves the whole screen: the month's statement columns, the
 * category split, the Total column and the twelve-month strip all arrive
 * together, already totalled by the API. The client never recomputes any of it.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { MonthKey, PnlResponseDto } from '@hostel/shared';
import { queryKeys } from '../api/queryKeys';
import { reportsApi } from '../api/resources';

export interface PnlParams {
  month: MonthKey;
  /** 'all', 'shared' or a building id - the global filter, passed through as-is. */
  buildingId: string;
  /** The calendar year behind the "Year to date" table. */
  year: number;
}

export function usePnl({ month, buildingId, year }: PnlParams): UseQueryResult<PnlResponseDto> {
  return useQuery<PnlResponseDto>({
    queryKey: queryKeys.reports.pnl({ month, buildingId, year }),
    queryFn: () => reportsApi.pnl({ month, buildingId, year }),
  });
}

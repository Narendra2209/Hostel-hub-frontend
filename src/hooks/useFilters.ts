/**
 * The global month / building / year filters, stored in the URL.
 *
 * Keeping them in the query string means every view is shareable and
 * refresh-safe: `/fees?month=2026-08&building=<id>` reopens exactly what a
 * colleague was looking at.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_BUILDINGS, currentMonthKey, isMonthKey, type MonthKey } from '@hostel/shared';

export interface Filters {
  month: MonthKey;
  buildingId: string;
  year: number;
  setMonth: (month: MonthKey) => void;
  setBuilding: (buildingId: string) => void;
  setYear: (year: number) => void;
  stepYear: (delta: number) => void;
  /** Ready-made params for a `{ month, buildingId }` query. */
  scope: { month: MonthKey; buildingId: string };
}

export function useFilters(): Filters {
  const [searchParams, setSearchParams] = useSearchParams();

  const month = useMemo<MonthKey>(() => {
    const raw = searchParams.get('month');
    return raw && isMonthKey(raw) ? raw : currentMonthKey();
  }, [searchParams]);

  const buildingId = searchParams.get('building') || ALL_BUILDINGS;

  const year = useMemo(() => {
    const raw = Number(searchParams.get('year'));
    return Number.isInteger(raw) && raw >= 2000 && raw <= 2200 ? raw : Number(month.slice(0, 4));
  }, [searchParams, month]);

  // `replace` keeps the back button meaningful: changing a filter should not
  // stack a dozen history entries.
  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setMonth = useCallback(
    (next: MonthKey) => {
      // Changing month rebases the year unless the user pinned one explicitly.
      update({ month: next, year: null });
    },
    [update],
  );

  const setBuilding = useCallback(
    (next: string) => update({ building: next === ALL_BUILDINGS ? null : next }),
    [update],
  );

  const setYear = useCallback((next: number) => update({ year: String(next) }), [update]);

  const stepYear = useCallback(
    (delta: number) => update({ year: String(year + delta) }),
    [update, year],
  );

  return useMemo(
    () => ({
      month,
      buildingId,
      year,
      setMonth,
      setBuilding,
      setYear,
      stepYear,
      scope: { month, buildingId },
    }),
    [month, buildingId, year, setMonth, setBuilding, setYear, stepYear],
  );
}

/**
 * Page-local list state (search / page / sort) that also lives in the URL, so
 * a filtered list survives a refresh.
 */
export function useListParams(defaults: {
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const set = useCallback(
    (patch: Record<string, string | number | null>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          // Any filter change returns to the first page - otherwise a narrower
          // result set can leave you stranded on an empty page 7.
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Number(searchParams.get('pageSize')) || defaults.pageSize || 20;
  const search = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? defaults.status ?? 'all';
  const sortBy = searchParams.get('sortBy') ?? defaults.sortBy ?? 'name';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') ?? defaults.sortOrder ?? 'asc';

  return {
    page,
    pageSize,
    search,
    status,
    sortBy,
    sortOrder,
    setPage: (next: number) => set({ page: next }),
    setPageSize: (next: number) => set({ pageSize: next, page: null }),
    setSearch: (next: string) => set({ q: next }),
    setStatus: (next: string) => set({ status: next }),
    setSort: (nextBy: string, nextOrder: 'asc' | 'desc') =>
      set({ sortBy: nextBy, sortOrder: nextOrder }),
    toggleSort: (column: string) =>
      set({
        sortBy: column,
        sortOrder: sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc',
      }),
  };
}

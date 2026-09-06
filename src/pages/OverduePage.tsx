/**
 * Overdue - every fee that is past its due date and still unpaid.
 *
 * Arrears are not a property of one month, so this is the one screen that
 * ignores the global month picker entirely: the topbar shows only the building
 * filter, and the API is asked for every unpaid month at once. The three stat
 * cards read `meta.totals` verbatim - nothing on this page adds a column up.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Card, StatCard, StatGrid } from '../components/common/Card';
import { Pagination } from '../components/common/Pagination';
import {
  EmptyState,
  ErrorState,
  QueryBoundary,
  StatsSkeleton,
  TableSkeleton,
} from '../components/common/states';
import {
  OverdueResidentTable,
  OverdueTable,
  type OverdueSort,
  type OverdueSortKey,
} from '../components/fees/OverdueTable';
import { PageBody } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { usePermissions } from '../auth/AuthProvider';
import { useFilters, useListParams } from '../hooks/useFilters';
import { useOverdueByMonth, useOverdueByResident } from '../hooks/useOverdue';
import { useMoney } from '../hooks/useSettings';
import { pluralise } from '../utils/format';
import type { OverdueParams } from '../api/resources';

type GroupBy = 'month' | 'resident';

/** The grouping lives in the URL like every other filter, so it is shareable. */
function useGroupBy(): [GroupBy, (next: GroupBy) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const groupBy: GroupBy = searchParams.get('groupBy') === 'resident' ? 'resident' : 'month';

  const setGroupBy = useCallback(
    (next: GroupBy) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === 'month') params.delete('groupBy');
          else params.set('groupBy', next);
          // A different grouping means a different row count; page 4 of the
          // month view is meaningless in the resident view.
          params.delete('page');
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [groupBy, setGroupBy];
}

export function OverduePage(): JSX.Element {
  const { buildingId } = useFilters();
  const { money } = useMoney();
  const { canRecordTransactions } = usePermissions();
  const [groupBy, setGroupBy] = useGroupBy();

  const { page, pageSize, search, sortBy, sortOrder, setPage, setPageSize, setSearch, toggleSort } =
    useListParams({ pageSize: 50, sortBy: 'daysOverdue', sortOrder: 'desc' });

  // The box types locally and settles into the URL, so one keystroke is not
  // one request.
  const [searchDraft, setSearchDraft] = useState(search);
  const searchTimer = useRef<number | undefined>(undefined);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const onSearchChange = (value: string): void => {
    setSearchDraft(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => setSearch(value), 300);
  };

  const params: OverdueParams = {
    page,
    pageSize,
    buildingId,
    search: search || undefined,
    sortBy,
    sortOrder,
  };

  const monthQuery = useOverdueByMonth(params, { enabled: groupBy === 'month' });
  const residentQuery = useOverdueByResident(params, { enabled: groupBy === 'resident' });

  const byResident = groupBy === 'resident';
  const { isLoading, error } = byResident ? residentQuery : monthQuery;
  const meta = (byResident ? residentQuery.data : monthQuery.data)?.meta;
  const totals = meta?.totals;

  const monthRows = monthQuery.data?.items ?? [];
  const residentRows = residentQuery.data?.items ?? [];
  const isEmpty = (byResident ? residentRows : monthRows).length === 0;

  const retry = useCallback(() => {
    void (byResident ? residentQuery.refetch() : monthQuery.refetch());
  }, [byResident, residentQuery, monthQuery]);

  const sort: OverdueSort = {
    sortBy,
    sortOrder,
    onToggle: (column: OverdueSortKey) => toggleSort(column),
  };

  return (
    <>
      <TopBar title="Overdue" showMonth={false} />
      <PageBody>
        {isLoading ? (
          <StatsSkeleton count={3} />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} title="Could not load the overdue figures" />
        ) : totals ? (
          <StatGrid>
            <StatCard
              eyebrow="Total overdue"
              value={money(totals.totalOverdue)}
              tone="late"
              foot={`across ${pluralise(totals.overdueMonthCount, 'unpaid month')}`}
            />
            <StatCard
              eyebrow="Residents involved"
              value={totals.residentCount}
              foot={`of ${totals.stayingResidentCount} staying`}
            />
            <StatCard
              eyebrow="Oldest arrears"
              value={`${totals.oldestDaysOverdue} days`}
              valueStyle={{ fontSize: 19 }}
              foot={totals.oldestResidentName ?? 'nothing pending'}
            />
          </StatGrid>
        ) : null}

        <Card
          title={byResident ? 'Everyone past their due date' : 'Every unpaid month, past due date'}
          actions={
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              Print list
            </Button>
          }
        >
          <div className="filters">
            <input
              className="search"
              type="search"
              value={searchDraft}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name or phone"
              aria-label="Search residents in arrears"
            />
            <div style={{ flex: 1 }} />
            <div className="inline-actions" role="group" aria-label="Group the list by">
              <Button
                size="sm"
                variant={byResident ? 'ghost' : 'primary'}
                aria-pressed={!byResident}
                onClick={() => setGroupBy('month')}
              >
                Every unpaid month
              </Button>
              <Button
                size="sm"
                variant={byResident ? 'primary' : 'ghost'}
                aria-pressed={byResident}
                onClick={() => setGroupBy('resident')}
              >
                By resident
              </Button>
            </div>
          </div>

          <QueryBoundary
            isLoading={isLoading}
            error={error}
            onRetry={retry}
            isEmpty={isEmpty}
            errorTitle="Could not load the overdue list"
            skeleton={<TableSkeleton rows={8} columns={byResident ? 7 : 9} />}
            empty={
              <EmptyState
                title="Nothing is overdue"
                message="Every fee is either paid or not due yet."
              />
            }
          >
            {byResident ? (
              <OverdueResidentTable rows={residentRows} sort={sort} />
            ) : (
              <OverdueTable rows={monthRows} sort={sort} canSettle={canRecordTransactions} />
            )}
            <Pagination
              meta={meta}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel={byResident ? 'residents' : 'unpaid months'}
            />
          </QueryBoundary>
        </Card>
      </PageBody>
    </>
  );
}

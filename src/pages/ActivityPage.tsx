/**
 * Activity - the record of who changed what.
 *
 * This is the audit trail rendered for people rather than for machines, and it
 * is the one screen that has no month and no building: an edit made in March to
 * a resident who has since moved buildings belongs in the same list as a bill
 * logged this morning. Showing the global pickers here would imply a scope the
 * data does not have, so the top bar carries none.
 *
 * Reading it is a capability, not a rank: OWNER, ADMIN and DEVELOPER may, a
 * MANAGER and a VIEWER may not. The API enforces that on every request; the
 * check here only decides whether to ask.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ActivityEntryDto } from '@hostel/shared';
import type { ActivityListParams } from '../api/activity.api';
import { ApiClientError } from '../api/client';
import { usePermissions } from '../auth/AuthProvider';
import {
  ActivityFilters,
  EMPTY_ACTIVITY_FILTERS,
  type ActivityFilterValues,
} from '../components/activity/ActivityFilters';
import {
  ActivityTable,
  activityDate,
  activityTime,
} from '../components/activity/ActivityTable';
import { Button } from '../components/common/Button';
import { Card, StatCard, StatGrid } from '../components/common/Card';
import { Pagination } from '../components/common/Pagination';
import {
  EmptyState,
  QueryBoundary,
  StatsSkeleton,
  TableSkeleton,
} from '../components/common/states';
import { PageBody } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { useActivity } from '../hooks/useActivity';
import { useListParams } from '../hooks/useFilters';
import { entries, pluralise } from '../utils/format';

/** The filter keys this screen keeps in the query string, under their own names. */
const FILTER_KEYS = ['entityType', 'actorId', 'action', 'from', 'to'] as const;

/**
 * The five filters `useListParams` does not know about, kept in the URL beside
 * the ones it does so the whole view stays shareable and refresh-safe.
 */
function useActivityFilters(): [
  ActivityFilterValues,
  (patch: Partial<ActivityFilterValues>) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo<ActivityFilterValues>(
    () => ({
      entityType: searchParams.get('entityType') ?? '',
      actorId: searchParams.get('actorId') ?? '',
      action: searchParams.get('action') ?? '',
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
    }),
    [searchParams],
  );

  const update = useCallback(
    (patch: Partial<ActivityFilterValues>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const key of FILTER_KEYS) {
            const value = patch[key];
            if (value === undefined) continue;
            if (value === '') next.delete(key);
            else next.set(key, value);
          }
          // A narrower log leaves page 6 empty; every filter change starts again.
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [values, update];
}

/** The newest entry on the page, whatever order the rows arrived in. */
function newestEntry(rows: ActivityEntryDto[]): ActivityEntryDto | null {
  let newest: ActivityEntryDto | null = null;
  let newestTime = Number.NEGATIVE_INFINITY;
  for (const entry of rows) {
    const time = Date.parse(entry.at);
    if (!Number.isNaN(time) && time > newestTime) {
      newestTime = time;
      newest = entry;
    }
  }
  return newest;
}

export function ActivityPage(): JSX.Element {
  const { canViewActivityLog } = usePermissions();
  const { page, pageSize, search, sortOrder, setPage, setPageSize, setSearch } = useListParams({
    pageSize: 50,
    sortOrder: 'desc',
  });
  const [filters, setFilters] = useActivityFilters();

  const params: ActivityListParams = {
    page,
    pageSize,
    search: search || undefined,
    entityType: filters.entityType || undefined,
    actorId: filters.actorId || undefined,
    action: filters.action || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    sortOrder,
  };

  // Asking for a log we may not read only buys a 403, so the refusal is built
  // locally instead. It renders through the same ErrorState the API's own 403
  // would, which is what keeps "not allowed" from ever looking like "no rows".
  const query = useActivity(params, { enabled: canViewActivityLog });
  const forbidden = canViewActivityLog
    ? null
    : new ApiClientError(
        'The activity log is available to owners, admins and developers.',
        'FORBIDDEN',
        403,
      );

  const rows = query.data?.items ?? [];
  const meta = query.data?.meta;
  const error: unknown = forbidden ?? query.error;
  const isLoading = canViewActivityLog && query.isLoading;

  // A refusal is a refusal whether it came from here or from the API, and
  // neither is worth a "Try again" button.
  const refused = error instanceof ApiClientError && error.isPermissionError;

  const retry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const filtered = search.length > 0 || Object.values(filters).some((value) => value.length > 0);
  const newest = newestEntry(rows);
  const actorCount = meta?.filters.actors.length ?? 0;

  return (
    <>
      {/* No month, no building: this log spans all of both. */}
      <TopBar title="Activity" showFilters={false} />
      <PageBody>
        {/* Figures stay skeletons until they are real, and a failure is reported
            once, by the panel below, which owns the retry. */}
        {isLoading ? (
          <StatsSkeleton count={3} />
        ) : meta ? (
          <StatGrid>
            <StatCard
              eyebrow="Entries recorded"
              value={meta.total}
              foot={filtered ? 'matching these filters' : 'every change on record'}
            />
            <StatCard
              eyebrow="People making changes"
              value={actorCount}
              foot={actorCount === 1 ? 'account appears in the log' : 'accounts appear in the log'}
            />
            <StatCard
              eyebrow="Most recent change"
              value={
                newest ? `${activityDate(newest.at)} · ${activityTime(newest.at)}` : 'nothing yet'
              }
              valueStyle={{ fontSize: 19 }}
              foot={
                newest
                  ? page === 1 && sortOrder === 'desc'
                    ? `by ${newest.actor.name}`
                    : 'newest on this page'
                  : 'no entries in range'
              }
            />
          </StatGrid>
        ) : null}

        <Card
          title="Who changed what"
          hint={
            meta ? `${entries(meta.total)} · ${pluralise(actorCount, 'person', 'people')}` : undefined
          }
        >
          {/* No point offering filters over a log this account may not read. */}
          {refused ? null : (
            <ActivityFilters
              search={search}
              onSearchChange={setSearch}
              values={filters}
              onChange={setFilters}
              options={meta?.filters}
            />
          )}

          <QueryBoundary
            isLoading={isLoading}
            error={error}
            onRetry={refused ? undefined : retry}
            isEmpty={rows.length === 0}
            errorTitle={refused ? undefined : 'Could not load the activity log'}
            skeleton={<TableSkeleton rows={8} columns={5} />}
            empty={
              filtered ? (
                <EmptyState
                  title="Nothing matches those filters"
                  message="Widen the dates, or clear the filters to see the whole log."
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setFilters(EMPTY_ACTIVITY_FILTERS);
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="Nothing recorded yet"
                  message="Changes to residents, payments, staff and bills will appear here."
                />
              )
            }
          >
            <ActivityTable rows={rows} />
            <Pagination
              meta={meta}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="entries"
            />
          </QueryBoundary>
        </Card>
      </PageBody>
    </>
  );
}

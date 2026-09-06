/**
 * Bills & expenses.
 *
 * One request feeds the whole screen: the list endpoint returns the month's
 * bills together with `meta.totals`, which already holds the month total, the
 * entry count and the per-building split. The stat row renders those figures
 * as they arrived - the shared bucket included - and never re-adds the rows.
 */
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_BUILDINGS, formatMonthLabel } from '@hostel/shared';
import type { ExpenseListParams } from '../api/resources';
import { usePermissions } from '../auth/AuthProvider';
import { StatCard, StatGrid } from '../components/common/Card';
import { StatsSkeleton } from '../components/common/states';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { ExpenseTable } from '../components/expenses/ExpenseTable';
import { PageBody } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { useExpenseList } from '../hooks/useExpenses';
import { useFilters, useListParams } from '../hooks/useFilters';
import { useBuildingName, useBuildings, useExpenseCategories, useMoney } from '../hooks/useSettings';
import { entries } from '../utils/format';

export function ExpensesPage(): JSX.Element {
  const { month, buildingId } = useFilters();
  const { page, pageSize, search, setPage, setSearch } = useListParams({ pageSize: 20 });
  const [searchParams, setSearchParams] = useSearchParams();
  const { money } = useMoney();
  const { canRecordTransactions } = usePermissions();

  const buildingsQuery = useBuildings();
  const categoriesQuery = useExpenseCategories();
  const buildingName = useBuildingName(buildingId);
  const filteredByBuilding = buildingId !== ALL_BUILDINGS;

  const categoryId = searchParams.get('category') ?? '';
  const editId = searchParams.get('edit');

  const params: ExpenseListParams = {
    page,
    pageSize,
    month,
    buildingId: filteredByBuilding ? buildingId : undefined,
    categoryId: categoryId || undefined,
    search: search || undefined,
  };

  const query = useExpenseList(params);
  const rows = query.data?.items ?? [];
  const meta = query.data?.meta;
  const totals = meta?.totals;

  // The bill being edited must be on the page in front of us; anything else
  // falls back to the "Log a bill" form.
  const editing = editId ? (rows.find((expense) => expense.id === editId) ?? null) : null;

  const setParam = useCallback(
    (key: string, value: string | null, resetPage: boolean) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // A bill that has been removed, or filtered off the page, leaves edit mode
  // rather than stranding `?edit=` on a form that is back to logging new bills.
  useEffect(() => {
    if (editId && !query.isLoading && !editing) setParam('edit', null, false);
  }, [editId, query.isLoading, editing, setParam]);

  const monthLabel = formatMonthLabel(month);
  const countFoot = totals
    ? `${entries(totals.count)}${filteredByBuilding ? ` · ${buildingName}` : ''}`
    : '';

  const filters = (
    <div className="filters">
      <input
        className="search"
        type="search"
        value={search}
        placeholder="Search vendor or note"
        aria-label="Search bills"
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        value={categoryId}
        aria-label="Category"
        onChange={(event) => setParam('category', event.target.value, true)}
        disabled={categoriesQuery.isLoading}
      >
        <option value="">All categories</option>
        {(categoriesQuery.data ?? []).map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <TopBar title="Bills & expenses" />
      <PageBody>
        {/* Figures stay skeletons until they are real; a failure is reported
            once, by the table below, which owns the retry. */}
        {query.isLoading ? (
          <StatsSkeleton count={(buildingsQuery.data?.length ?? 2) + 1} />
        ) : totals ? (
          <StatGrid>
            <StatCard
              eyebrow={`Bills · ${monthLabel}`}
              value={money(totals.total)}
              foot={countFoot}
            />
            {totals.byBuilding.map((bucket) => (
              <StatCard
                key={bucket.buildingId ?? 'shared'}
                eyebrow={bucket.buildingName}
                value={money(bucket.amount)}
                foot="this month"
              />
            ))}
          </StatGrid>
        ) : null}

        <div className="stack">
          {canRecordTransactions ? (
            <ExpenseForm expense={editing} onDone={() => setParam('edit', null, false)} />
          ) : null}

          <ExpenseTable
            month={month}
            rows={rows}
            meta={meta}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => {
              void query.refetch();
            }}
            onPageChange={setPage}
            onEdit={(expense) => setParam('edit', expense.id, false)}
            canEdit={canRecordTransactions}
            filters={filters}
          />
        </div>
      </PageBody>
    </>
  );
}

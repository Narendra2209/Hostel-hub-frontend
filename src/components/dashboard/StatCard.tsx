/**
 * The Overview's six headline tiles.
 *
 * The tile itself is the shared `.stat` card - re-exported here so every piece
 * of the dashboard can be imported from `components/dashboard` - arranged in
 * the exact order, wording and accent the reference UI used. Every figure is
 * read straight off the dashboard payload; nothing on this row is recomputed.
 */
import { formatMonthLabel } from '@hostel/shared';
import { StatCard, StatGrid } from '../common/Card';
import { QueryBoundary, StatsSkeleton } from '../common/states';
import type { DashboardPanelProps } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import { useMoney } from '../../hooks/useSettings';
import { pluralise } from '../../utils/format';

export { StatCard } from '../common/Card';

export function DashboardStats({
  dashboard,
  isLoading,
  error,
  onRetry,
}: DashboardPanelProps): JSX.Element {
  const { month } = useFilters();
  const { money, signedMoney } = useMoney();
  const monthName = formatMonthLabel(month);

  return (
    <QueryBoundary
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      skeleton={<StatsSkeleton count={6} />}
      errorTitle="The overview did not load"
    >
      {dashboard ? (
        <StatGrid>
          <StatCard
            eyebrow="Residents"
            value={dashboard.residentCount}
            foot={
              dashboard.buildingId === null
                ? `across ${pluralise(dashboard.buildingCount, 'building')}`
                : `in ${dashboard.buildingName}`
            }
          />
          <StatCard
            eyebrow={`Collected · ${monthName}`}
            value={money(dashboard.collectedFees)}
            foot={`of ${money(dashboard.expectedFees)} billed`}
            tone="ok"
          />
          <StatCard
            eyebrow="Still to collect"
            value={money(dashboard.outstandingThisMonth)}
            foot="this month only"
          />
          <StatCard
            eyebrow="Overdue, all months"
            value={money(dashboard.overdueAllMonths)}
            foot={`${pluralise(dashboard.overdueResidentCount, 'resident')} past due date`}
            tone="late"
          />
          <StatCard
            eyebrow={`Spent · ${monthName}`}
            value={money(dashboard.totalSpent)}
            foot={`${money(dashboard.salaryPaid)} salaries · ${money(dashboard.expenses)} bills`}
          />
          <StatCard
            eyebrow="Net for the month"
            value={signedMoney(dashboard.net)}
            foot="collected minus spent"
            tone={dashboard.net >= 0 ? 'ok' : 'late'}
          />
        </StatGrid>
      ) : null}
    </QueryBoundary>
  );
}

/**
 * "Bills" - what the month's running costs went on.
 *
 * One `.catrow` per expense category, sized against the largest category (a
 * bar width is the only arithmetic on this screen), then the salaries paid and
 * the total spent, both taken straight from the dashboard payload.
 */
import { formatMonthLabel } from '@hostel/shared';
import { Card } from '../common/Card';
import { EmptyState, QueryBoundary, TableSkeleton } from '../common/states';
import type { DashboardPanelProps } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import { useMoney } from '../../hooks/useSettings';
import { barWidth } from '../../utils/format';

export function ExpenseBreakdown({
  dashboard,
  isLoading,
  error,
  onRetry,
}: DashboardPanelProps): JSX.Element {
  const { month } = useFilters();
  const { money } = useMoney();
  const categories = dashboard?.expenseBreakdown ?? [];
  // Presentational only: the bars are scaled against the biggest category.
  const largest = categories.reduce((max, item) => Math.max(max, item.amount), 0);

  return (
    <Card title={`Bills · ${formatMonthLabel(month)}`}>
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={categories.length === 0}
        skeleton={<TableSkeleton rows={5} columns={3} />}
        errorTitle="The bills breakdown did not load"
        empty={
          <EmptyState
            title="Nothing logged this month"
            message={'Add electricity, water or mess bills under Bills & expenses.'}
          />
        }
      >
        {dashboard ? (
          <>
            {categories.map((item) => (
              <div className="catrow" key={item.categoryId}>
                <div style={{ minWidth: 106 }}>{item.categoryName}</div>
                <div className="catwrap">
                  <div className="catbar" style={{ width: barWidth(item.amount, largest) }} />
                </div>
                <div className="num r" style={{ minWidth: 72 }}>
                  {money(item.amount)}
                </div>
              </div>
            ))}

            <div className="catrow" style={{ borderTop: '1px solid var(--rule)' }}>
              <div>Salaries paid</div>
              <div className="num r">{money(dashboard.salaryPaid)}</div>
            </div>

            <div className="catrow" style={{ background: '#F7FAFB' }}>
              <b>Total spent</b>
              <b className="num r">{money(dashboard.totalSpent)}</b>
            </div>
          </>
        ) : null}
      </QueryBoundary>
    </Card>
  );
}

/**
 * "Salary run" - who is on the payroll this month and what is left to pay.
 *
 * The status and the outstanding balance are the server's; the chip only picks
 * the wording, exactly as the reference UI did.
 */
import { formatMonthLabel } from '@hostel/shared';
import { Card, TableScroll } from '../common/Card';
import { SalaryStatusChip } from '../common/StatusChip';
import { EmptyState, QueryBoundary, TableSkeleton } from '../common/states';
import type { DashboardPanelProps } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import { useMoney } from '../../hooks/useSettings';

export function SalarySummary({
  dashboard,
  isLoading,
  error,
  onRetry,
}: DashboardPanelProps): JSX.Element {
  const { month } = useFilters();
  const { money } = useMoney();
  const rows = dashboard?.salarySummary ?? [];

  return (
    <Card title={`Salary run · ${formatMonthLabel(month)}`}>
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={rows.length === 0}
        skeleton={<TableSkeleton rows={4} columns={3} />}
        errorTitle="The salary run did not load"
        empty={
          <EmptyState
            title="No staff here"
            message="Add cook, warden or cleaning staff on the Staff tab."
          />
        }
      >
        <TableScroll>
          <table>
            <tbody>
              {rows.map((item) => (
                <tr key={item.staffId}>
                  <td>
                    <div className="name">{item.name}</div>
                    <div className="sub">
                      {[item.role, item.buildingName ?? 'all buildings']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </td>
                  <td className="r num">{money(item.salary)}</td>
                  <td className="r">
                    <SalaryStatusChip status={item.status} balanceLabel={money(item.balance)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </QueryBoundary>
    </Card>
  );
}

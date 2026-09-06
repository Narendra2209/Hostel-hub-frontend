/**
 * The Jan-Dec fee cards for the residents staying this month.
 *
 * Both the roster and every strip arrive inside the dashboard payload, so the
 * table costs no extra request - never one per resident. The year steppers move
 * the global `year` filter, which re-fetches the one dashboard call.
 */
import { Link } from 'react-router-dom';
import type { DashboardDto } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, TableScroll } from '../common/Card';
import { FeeStrip, FeeStripLegend } from '../common/StatusChip';
import { EmptyState, QueryBoundary, TableSkeleton } from '../common/states';
import type { DashboardPanelProps } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import { useMoney } from '../../hooks/useSettings';

export function FeeCardTable({
  dashboard,
  isLoading,
  error,
  onRetry,
}: DashboardPanelProps): JSX.Element {
  const { year, stepYear } = useFilters();
  const residents = dashboard?.feeStripResidents ?? [];

  return (
    <Card
      title={`Fee card · ${year}`}
      actions={
        <div className="inline-actions">
          <Button variant="ghost" size="sm" onClick={() => stepYear(-1)} aria-label="Previous year">
            ←
          </Button>
          <Button variant="ghost" size="sm" onClick={() => stepYear(1)} aria-label="Next year">
            →
          </Button>
        </div>
      }
    >
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={residents.length === 0}
        skeleton={<TableSkeleton rows={6} columns={3} />}
        errorTitle="The fee cards did not load"
        empty={
          <EmptyState title="No residents here yet" message="Add someone on the Residents tab." />
        }
      >
        {dashboard ? <StripTable dashboard={dashboard} /> : null}
      </QueryBoundary>

      {residents.length > 0 ? <FeeStripLegend /> : null}
    </Card>
  );
}

function StripTable({ dashboard }: { dashboard: DashboardDto }): JSX.Element {
  const { money } = useMoney();
  const stripsByResident = new Map(
    dashboard.feeStrips.map((strip) => [strip.residentId, strip.months]),
  );

  return (
    <TableScroll>
      <table>
        <thead>
          <tr>
            <th>Resident</th>
            <th>Jan → Dec</th>
            <th className="r">Monthly rent</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.feeStripResidents.map((resident) => (
            <tr key={resident.residentId}>
              <td>
                <div className="name">
                  <Link className="link" to={`/residents/${resident.residentId}`}>
                    {resident.name}
                  </Link>
                </div>
                <div className="sub">{resident.buildingName}</div>
              </td>
              <td>
                <FeeStrip
                  months={stripsByResident.get(resident.residentId) ?? []}
                  year={dashboard.feeStripYear}
                />
              </td>
              <td className="r num">{money(resident.monthlyFee)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

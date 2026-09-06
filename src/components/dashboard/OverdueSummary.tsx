/**
 * "Who owes money" - the twelve largest debts, past the due date.
 *
 * The server groups the arrears by resident, sorts them largest first and caps
 * the card at twelve; when more residents are behind it also says how many in
 * total, so the footer can point at the Overdue screen for the rest.
 */
import { Link } from 'react-router-dom';
import { formatMonthLabel } from '@hostel/shared';
import { Card, TableScroll } from '../common/Card';
import { BuildingChip } from '../common/StatusChip';
import { EmptyState, QueryBoundary, TableSkeleton } from '../common/states';
import type { DashboardPanelProps } from '../../hooks/useDashboard';
import { useMoney } from '../../hooks/useSettings';
import { EM_DASH, owedStyle } from '../../utils/format';

/** The server's own cap for this card; the footer quotes it. */
const CARD_LIMIT = 12;

export function OverdueSummary({
  dashboard,
  isLoading,
  error,
  onRetry,
}: DashboardPanelProps): JSX.Element {
  const { money } = useMoney();
  const rows = dashboard?.overdueResidents ?? [];
  const hasMore = (dashboard?.overdueResidentTotal ?? 0) > CARD_LIMIT;

  return (
    <Card title="Who owes money" hint="Past the due date">
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={rows.length === 0}
        skeleton={<TableSkeleton rows={6} columns={4} />}
        errorTitle="The overdue list did not load"
        empty={
          <EmptyState
            title="Nobody is overdue"
            message="Everyone is settled up to their due date."
          />
        }
      >
        <TableScroll>
          <table>
            <thead>
              <tr>
                <th>Resident</th>
                <th>Building</th>
                <th>Unpaid from</th>
                <th className="r">Amount due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.residentId}>
                  <td>
                    <div className="name">
                      <Link className="link" to={`/residents/${row.residentId}`}>
                        {row.residentName}
                      </Link>
                    </div>
                    <div className="sub">{row.phone ?? 'no phone on file'}</div>
                  </td>
                  <td>
                    <BuildingChip name={row.buildingName} />
                  </td>
                  <td>
                    {row.oldestUnpaidMonth ? formatMonthLabel(row.oldestUnpaidMonth) : EM_DASH}
                  </td>
                  <td className="r num" style={owedStyle(row.totalOverdue)}>
                    {money(row.totalOverdue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </QueryBoundary>

      {hasMore ? (
        <div
          className="hint"
          style={{ padding: '11px 16px', borderTop: '1px solid var(--rule-soft)' }}
        >
          Showing the {CARD_LIMIT} largest. Open Overdue for the full list.
        </div>
      ) : null}
    </Card>
  );
}

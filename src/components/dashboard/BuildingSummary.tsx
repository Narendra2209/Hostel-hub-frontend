/**
 * "Building by building" - the Overview's cross-tab of the month.
 *
 * Rendered only while the building filter is `all`. Tapping a building name
 * sets the global filter, so the whole application narrows to it. Shared costs
 * (a bill or a salary nobody attributed to a building) get their own row and
 * are never spread across the buildings; the server folds them into the totals
 * it returns, and that row is what the `tfoot` renders.
 */
import type { CSSProperties } from 'react';
import type { BuildingSummaryDto, DashboardDto } from '@hostel/shared';
import { formatMonthLabel } from '@hostel/shared';
import { Card, TableScroll } from '../common/Card';
import { EmptyState, QueryBoundary, TableSkeleton } from '../common/states';
import type { DashboardPanelProps } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import { useMoney } from '../../hooks/useSettings';
import { EM_DASH, netStyle, owedStyle } from '../../utils/format';

/** A `.link` that is a real button, so the filter is keyboard operable. */
const LINK_BUTTON: CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  font: 'inherit',
  cursor: 'pointer',
};

/** The shared row only earns its place once something unattributed exists. */
const visibleRows = (rows: BuildingSummaryDto[]): BuildingSummaryDto[] =>
  rows.filter((row) => !row.shared || row.bills > 0 || row.salaries > 0);

export function BuildingSummary({
  dashboard,
  isLoading,
  error,
  onRetry,
}: DashboardPanelProps): JSX.Element {
  const { month } = useFilters();
  const rows = dashboard ? visibleRows(dashboard.buildingSummary) : [];

  return (
    <Card
      title={`Building by building · ${formatMonthLabel(month)}`}
      hint="Tap a building name to filter everything"
      style={{ marginBottom: 18 }}
    >
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={rows.length === 0}
        skeleton={<TableSkeleton rows={4} columns={8} />}
        errorTitle="The building summary did not load"
        empty={<EmptyState title="No buildings yet" message="Add one under Settings." />}
      >
        {dashboard ? <SummaryTable dashboard={dashboard} rows={rows} /> : null}
      </QueryBoundary>
    </Card>
  );
}

function SummaryTable({
  dashboard,
  rows,
}: {
  dashboard: DashboardDto;
  rows: BuildingSummaryDto[];
}): JSX.Element {
  const { setBuilding } = useFilters();
  const { money, signedMoney } = useMoney();
  const totals = dashboard.buildingSummaryTotals;
  const buildingCount = rows.filter((row) => !row.shared).length;

  return (
    <TableScroll>
      <table>
        <thead>
          <tr>
            <th>Building</th>
            <th className="r">Residents</th>
            <th className="r">Billed</th>
            <th className="r">Collected</th>
            <th className="r">Overdue</th>
            <th className="r">Bills</th>
            <th className="r">Salaries</th>
            <th className="r">Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const buildingId = row.buildingId;
            return (
              <tr key={buildingId ?? 'shared'}>
                <td>
                  {buildingId === null ? (
                    row.buildingName
                  ) : (
                    <button
                      type="button"
                      className="link"
                      style={LINK_BUTTON}
                      onClick={() => setBuilding(buildingId)}
                    >
                      {row.buildingName}
                    </button>
                  )}
                </td>
                <td className="r num">{row.shared ? EM_DASH : row.residentCount}</td>
                <td className="r num">{row.shared ? EM_DASH : money(row.billed)}</td>
                <td className="r num">{row.shared ? EM_DASH : money(row.collected)}</td>
                <td className="r num" style={row.shared ? undefined : owedStyle(row.overdue)}>
                  {row.shared || row.overdue <= 0 ? EM_DASH : money(row.overdue)}
                </td>
                <td className="r num">{money(row.bills)}</td>
                <td className="r num">{money(row.salaries)}</td>
                <td className="r num" style={netStyle(row.net)}>
                  {signedMoney(row.net)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>{buildingCount === 3 ? 'All three' : 'All buildings'}</td>
            <td className="r num">{totals.residentCount}</td>
            <td className="r num">{money(totals.billed)}</td>
            <td className="r num">{money(totals.collected)}</td>
            <td className="r num" style={owedStyle(totals.overdue)}>
              {totals.overdue > 0 ? money(totals.overdue) : EM_DASH}
            </td>
            <td className="r num">{money(totals.bills)}</td>
            <td className="r num">{money(totals.salaries)}</td>
            <td className="r num" style={netStyle(totals.net)}>
              {signedMoney(totals.net)}
            </td>
          </tr>
        </tfoot>
      </table>
    </TableScroll>
  );
}

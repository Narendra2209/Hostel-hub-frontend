/**
 * The "Statement · {Mon YYYY}" card.
 *
 * A column per building (plus the shared column when unattributed costs exist,
 * plus the Total column unless one building is filtered), and one row per line
 * of the cash-basis statement. Every figure - collected, billed, each category,
 * salaries, total expenses, net - is read straight off the PnlColumnDto the API
 * returned. Nothing on this screen adds a column up.
 */
import type { MonthKey, PnlColumnDto, PnlResponseDto } from '@hostel/shared';
import { formatMonthLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, TableScroll } from '../common/Card';
import { EmptyState, QueryBoundary, TableSkeleton } from '../common/states';
import { useMoney } from '../../hooks/useSettings';
import { EM_DASH, netStyle } from '../../utils/format';

/** The reference UI shaded the totals line this colour. */
const TOTAL_ROW_BACKGROUND = '#F7FAFB';

export interface PnlStatementProps {
  month: MonthKey;
  report: PnlResponseDto | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** False when a single building is filtered - its column is already the total. */
  showTotal: boolean;
}

/** Stable react key for a column: a building id, or the synthetic shared/total column. */
const columnKey = (column: PnlColumnDto): string =>
  column.buildingId ?? (column.shared ? 'shared' : 'total');

export function PnlStatement({
  month,
  report,
  isLoading,
  error,
  onRetry,
  showTotal,
}: PnlStatementProps): JSX.Element {
  const { money, signedMoney } = useMoney();
  const monthName = formatMonthLabel(month);

  const columns: PnlColumnDto[] = report
    ? showTotal
      ? [...report.columns, report.total]
      : report.columns
    : [];
  // The line-label column plus one per money column.
  const span = columns.length + 1;

  return (
    <Card
      title={`Statement · ${monthName}`}
      hint="Cash basis — money in, money out"
      actions={
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          Print
        </Button>
      }
    >
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        errorTitle="Could not load the statement"
        skeleton={<TableSkeleton rows={8} columns={4} />}
        isEmpty={report ? report.columns.length === 0 : false}
        empty={
          <EmptyState
            title={`Nothing to report for ${monthName}`}
            message="Add a building under Settings to start recording income and costs."
          />
        }
      >
        {report ? (
          <>
            <TableScroll>
              <table>
                <thead>
                  <tr>
                    <th>
                      <span className="sr-only">Line</span>
                    </th>
                    {columns.map((column) => (
                      <th key={columnKey(column)} className="r">
                        {column.buildingName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="eyebrow" colSpan={span}>
                      Income
                    </td>
                  </tr>
                  <tr>
                    <td>Rent collected</td>
                    {columns.map((column) => (
                      <td key={columnKey(column)} className="r num">
                        {money(column.collected)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sub">Rent billed (memo)</td>
                    {columns.map((column) => (
                      <td key={columnKey(column)} className="r num sub">
                        {money(column.billed)}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="eyebrow" colSpan={span}>
                      Expenses
                    </td>
                  </tr>
                  {report.categoryNames.map((category) => (
                    <tr key={category.categoryId}>
                      <td>{category.categoryName}</td>
                      {columns.map((column) => {
                        const line = column.categories.find(
                          (entry) => entry.categoryId === category.categoryId,
                        );
                        return (
                          <td key={columnKey(column)} className="r num">
                            {line ? money(line.amount) : EM_DASH}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td>Salaries paid</td>
                    {columns.map((column) => (
                      <td key={columnKey(column)} className="r num">
                        {money(column.salaries)}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ background: TOTAL_ROW_BACKGROUND, fontWeight: 600 }}>
                    <td>Total expenses</td>
                    {columns.map((column) => (
                      <td key={columnKey(column)} className="r num">
                        {money(column.expenses)}
                      </td>
                    ))}
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>Profit / loss</td>
                    {columns.map((column) => (
                      <td key={columnKey(column)} className="r num" style={netStyle(column.net)}>
                        {signedMoney(column.net)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
            <div
              className="hint"
              style={{ padding: '12px 16px', borderTop: '1px solid var(--rule-soft)' }}
            >
              {money(report.total.arrears)} of {monthName} rent is overdue and not counted as income
              until it is collected.
            </div>
          </>
        ) : null}
      </QueryBoundary>
    </Card>
  );
}

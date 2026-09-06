/**
 * The "Year to date · {year}" card.
 *
 * Twelve rows straight from PnlResponseDto.yearToDate, with the API's own year
 * totals in the footer. The only arithmetic here is a bar's width percentage,
 * measured against the peak the report already worked out.
 */
import type { PnlResponseDto } from '@hostel/shared';
import { formatMonthLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, TableScroll } from '../common/Card';
import { EmptyState, QueryBoundary, TableSkeleton } from '../common/states';
import { useMoney } from '../../hooks/useSettings';
import { EM_DASH, barWidth, netStyle } from '../../utils/format';

export interface PnlYearTableProps {
  year: number;
  report: PnlResponseDto | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Steps the year filter in the URL. */
  onStepYear: (delta: number) => void;
}

export function PnlYearTable({
  year,
  report,
  isLoading,
  error,
  onRetry,
  onStepYear,
}: PnlYearTableProps): JSX.Element {
  const { money, signedMoney } = useMoney();

  return (
    <Card
      title={`Year to date · ${year}`}
      actions={
        <div className="inline-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStepYear(-1)}
            aria-label={`Show ${year - 1}`}
          >
            ←
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStepYear(1)}
            aria-label={`Show ${year + 1}`}
          >
            →
          </Button>
        </div>
      }
    >
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        errorTitle="Could not load the year to date"
        skeleton={<TableSkeleton rows={6} columns={5} />}
        isEmpty={report ? report.yearToDate.length === 0 : false}
        empty={
          <EmptyState
            title={`Nothing recorded in ${year}`}
            message="Log a fee payment or a bill to see the year build up."
          />
        }
      >
        {report ? (
          <TableScroll>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="r">Income</th>
                  <th className="r">Expenses</th>
                  <th className="r">Profit</th>
                  <th>Income vs expenses</th>
                </tr>
              </thead>
              <tbody>
                {report.yearToDate.map((row) => (
                  <tr key={row.month}>
                    <td>{formatMonthLabel(row.month)}</td>
                    <td className="r num">{row.collected === 0 ? EM_DASH : money(row.collected)}</td>
                    <td className="r num">{row.expenses === 0 ? EM_DASH : money(row.expenses)}</td>
                    <td className="r num" style={row.net === 0 ? undefined : netStyle(row.net)}>
                      {row.net === 0 ? EM_DASH : signedMoney(row.net)}
                    </td>
                    <td style={{ minWidth: 170 }}>
                      <div className="catwrap" style={{ margin: 0 }} aria-hidden="true">
                        <div
                          className="catbar"
                          style={{ width: barWidth(row.collected, report.peak, 0) }}
                        />
                      </div>
                      <div className="catwrap" style={{ margin: '3px 0 0' }} aria-hidden="true">
                        <div
                          className="catbar"
                          style={{
                            width: barWidth(row.expenses, report.peak, 0),
                            background: 'var(--late)',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{year} total</td>
                  <td className="r num">{money(report.yearTotals.collected)}</td>
                  <td className="r num">{money(report.yearTotals.expenses)}</td>
                  <td className="r num" style={netStyle(report.yearTotals.net)}>
                    {signedMoney(report.yearTotals.net)}
                  </td>
                  <td className="hint">teal = income · red = expenses</td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        ) : null}
      </QueryBoundary>
    </Card>
  );
}

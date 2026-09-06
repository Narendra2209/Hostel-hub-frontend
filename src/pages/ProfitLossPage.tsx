/**
 * Profit & loss.
 *
 * One report request feeds the four stat cards, the month's statement and the
 * year-to-date table. Every figure below - collected, expenses, net, accrual,
 * the year totals - is the API's own; the page only chooses the wording, the
 * colour and the currency format.
 */
import { ALL_BUILDINGS, formatMonthLabel, percentOf } from '@hostel/shared';
import { TopBar } from '../components/layout/TopBar';
import { PageBody } from '../components/layout/AppShell';
import { StatCard, StatGrid } from '../components/common/Card';
import { QueryBoundary, StatsSkeleton } from '../components/common/states';
import { PnlStatement } from '../components/dashboard/PnlStatement';
import { PnlYearTable } from '../components/dashboard/PnlYearTable';
import { useFilters } from '../hooks/useFilters';
import { useMoney } from '../hooks/useSettings';
import { usePnl } from '../hooks/usePnl';

export function ProfitLossPage(): JSX.Element {
  const { month, buildingId, year, stepYear } = useFilters();
  const { money, signedMoney } = useMoney();

  const query = usePnl({ month, buildingId, year });
  const report = query.data;
  const retry = () => void query.refetch();

  // Filtering to one building makes its column the whole statement, so the
  // reference dropped the Total column in that case.
  const showTotal = buildingId === ALL_BUILDINGS;
  const monthName = formatMonthLabel(month);

  return (
    <>
      <TopBar title="Profit & loss" />
      <PageBody>
        <QueryBoundary
          isLoading={query.isLoading}
          error={query.error}
          onRetry={retry}
          errorTitle="Could not load the profit & loss report"
          skeleton={<StatsSkeleton count={4} />}
        >
          {report ? (
            <StatGrid>
              <StatCard
                tone="ok"
                eyebrow={`Income · ${monthName}`}
                value={money(report.total.collected)}
                foot="rent actually received"
              />
              <StatCard
                tone="late"
                eyebrow="Expenses"
                value={money(report.total.expenses)}
                foot={`${money(report.total.salaries)} salaries · ${money(
                  report.total.billsTotal,
                )} bills`}
              />
              <StatCard
                tone={report.total.net >= 0 ? 'ok' : 'late'}
                eyebrow="Profit for the month"
                value={signedMoney(report.total.net)}
                foot={`${percentOf(report.total.net, report.total.collected)}% of income kept`}
              />
              <StatCard
                eyebrow="If everyone paid"
                value={signedMoney(report.total.accrual)}
                foot={`${money(report.total.billed)} billed less expenses`}
              />
            </StatGrid>
          ) : null}
        </QueryBoundary>

        <div className="stack">
          <PnlStatement
            month={month}
            report={report}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={retry}
            showTotal={showTotal}
          />
          <PnlYearTable
            year={year}
            report={report}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={retry}
            onStepYear={stepYear}
          />
        </div>
      </PageBody>
    </>
  );
}

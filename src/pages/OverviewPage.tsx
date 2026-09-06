/**
 * Overview - the screen the application opens on.
 *
 * One request (`GET /api/dashboard`) feeds every panel here: the six headline
 * tiles, the building-by-building table, who owes money, the fee cards, the
 * bills breakdown and the salary run. Each panel renders its own loading,
 * error and empty state from that shared result, and every figure on the page
 * is a number the backend already worked out.
 */
import { ALL_BUILDINGS } from '@hostel/shared';
import { PageBody } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { BuildingSummary } from '../components/dashboard/BuildingSummary';
import { DashboardStats } from '../components/dashboard/StatCard';
import { ExpenseBreakdown } from '../components/dashboard/ExpenseBreakdown';
import { FeeCardTable } from '../components/dashboard/FeeCardTable';
import { OverdueSummary } from '../components/dashboard/OverdueSummary';
import { SalarySummary } from '../components/dashboard/SalarySummary';
import { useDashboard, type DashboardPanelProps } from '../hooks/useDashboard';
import { useFilters } from '../hooks/useFilters';

export function OverviewPage(): JSX.Element {
  const { buildingId } = useFilters();
  const query = useDashboard();

  const panel: DashboardPanelProps = {
    dashboard: query.data,
    isLoading: query.isLoading,
    error: query.error,
    onRetry: () => {
      void query.refetch();
    },
  };

  return (
    <>
      <TopBar title="Overview" />
      <PageBody>
        <DashboardStats {...panel} />

        {/* The cross-tab only means something while every building is in scope. */}
        {buildingId === ALL_BUILDINGS ? <BuildingSummary {...panel} /> : null}

        <div className="grid2">
          <div className="stack">
            <OverdueSummary {...panel} />
            <FeeCardTable {...panel} />
          </div>
          <div className="stack">
            <ExpenseBreakdown {...panel} />
            <SalarySummary {...panel} />
          </div>
        </div>
      </PageBody>
    </>
  );
}

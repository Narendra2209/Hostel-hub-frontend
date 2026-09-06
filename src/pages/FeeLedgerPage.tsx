/**
 * Fee ledger (`/fees`).
 *
 * One month, one building filter, one query. The three stat cards read
 * `FeeLedgerResponseDto.totals` - the engine's own figures over exactly the
 * rows the table below is showing - so the headline and the table can never
 * disagree, and nothing here re-adds a column the API already totalled.
 */
import { TopBar } from '../components/layout/TopBar';
import { PageBody } from '../components/layout/AppShell';
import { StatCard, StatGrid } from '../components/common/Card';
import { StatsSkeleton } from '../components/common/states';
import { FeeLedger } from '../components/fees/FeeLedger';
import { PaymentHistory } from '../components/fees/PaymentHistory';
import { useFeeLedger } from '../hooks/useFees';
import { useFilters, useListParams } from '../hooks/useFilters';
import { useMoney } from '../hooks/useSettings';
import { pluralise } from '../utils/format';

export function FeeLedgerPage(): JSX.Element {
  const { month, buildingId } = useFilters();
  const { page, pageSize, search, status, sortBy, sortOrder, setPage, setPageSize, setSearch, setStatus } =
    useListParams({ pageSize: 20, sortBy: 'name', sortOrder: 'asc', status: 'all' });
  const { money } = useMoney();

  const ledger = useFeeLedger({ month, buildingId, search, status, sortBy, sortOrder });
  const totals = ledger.data?.totals;

  return (
    <>
      <TopBar title="Fee ledger" />
      <PageBody>
        {/* Figures are never rendered as zeroes while the ledger is in flight;
            a failure is reported once, inside the card below, with a retry. */}
        {ledger.isLoading ? (
          <StatsSkeleton count={3} />
        ) : totals ? (
          <StatGrid>
            <StatCard
              eyebrow="Billed"
              value={money(totals.expected)}
              foot={pluralise(totals.residentCount, 'resident')}
            />
            <StatCard
              eyebrow="Received"
              tone="ok"
              value={money(totals.paid)}
              foot={`${totals.collectionRate}% of the month`}
            />
            <StatCard
              eyebrow="Balance"
              tone="late"
              value={money(totals.balance)}
              foot="still to come in"
            />
          </StatGrid>
        ) : null}

        <div className="stack">
          <FeeLedger
            month={month}
            query={ledger}
            search={search}
            status={status}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
          />

          <PaymentHistory
            month={month}
            buildingId={buildingId}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </PageBody>
    </>
  );
}

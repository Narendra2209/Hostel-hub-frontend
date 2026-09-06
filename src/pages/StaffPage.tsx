/**
 * Staff & salaries.
 *
 * The payroll, what has gone out this month and what is still pending are all
 * figures the API returns with the register - this screen only renders them.
 */
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatMonthLabel } from '@hostel/shared';
import type { StaffLedgerRowDto } from '@hostel/shared';
import { TopBar } from '../components/layout/TopBar';
import { PageBody } from '../components/layout/AppShell';
import { Button } from '../components/common/Button';
import { Card, StatCard, StatGrid } from '../components/common/Card';
import { Pagination } from '../components/common/Pagination';
import { ErrorState, StatsSkeleton } from '../components/common/states';
import { SalaryPaymentForm } from '../components/staff/SalaryPaymentForm';
import { StaffForm } from '../components/staff/StaffForm';
import { StaffTable } from '../components/staff/StaffTable';
import { usePermissions } from '../auth/AuthProvider';
import { useFilters, useListParams } from '../hooks/useFilters';
import { useMoney } from '../hooks/useSettings';
import { useStaffLedger } from '../hooks/useStaff';

export function StaffPage(): JSX.Element {
  const { month, buildingId } = useFilters();
  const { money } = useMoney();
  const { canRecordTransactions, canManageRecords } = usePermissions();
  const { page, pageSize, setPage, setPageSize } = useListParams({ pageSize: 20 });
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const ledger = useStaffLedger({ month, buildingId, page, pageSize, status: 'all' });
  const rows = ledger.data?.items ?? [];
  const totals = ledger.data?.meta.totals;
  const monthLabel = formatMonthLabel(month);

  // Which member is being edited lives in the URL, so the form survives a
  // refresh and the link can be shared.
  const editId = searchParams.get('edit');
  const editing = rows.find((row) => row.id === editId) ?? null;

  const setEdit = useCallback(
    (id: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) next.set('edit', id);
          else next.delete('edit');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const onEdit = useCallback(
    (staff: StaffLedgerRowDto) => {
      setEdit(staff.id);
    },
    [setEdit],
  );

  return (
    <>
      <TopBar title="Staff & salaries" />
      <PageBody>
        {ledger.isLoading ? (
          <StatsSkeleton count={3} />
        ) : ledger.error ? (
          <ErrorState
            error={ledger.error}
            onRetry={() => void ledger.refetch()}
            title="Could not load the payroll"
          />
        ) : totals ? (
          <StatGrid>
            <StatCard
              eyebrow="Monthly payroll"
              value={money(totals.payroll)}
              foot={`${totals.activeCount} staff on duty`}
            />
            <StatCard
              eyebrow={`Paid · ${monthLabel}`}
              tone="ok"
              value={money(totals.paid)}
              foot={`${totals.paidPercent}% of payroll`}
            />
            <StatCard
              eyebrow="Pending"
              tone="late"
              value={money(totals.pending)}
              foot="still to pay out"
            />
          </StatGrid>
        ) : null}

        {canManageRecords ? <StaffForm editing={editing} onDone={() => setEdit(null)} /> : null}

        <Card
          title={`Salary register · ${monthLabel}`}
          actions={
            canRecordTransactions ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={rows.length === 0}
                onClick={() => setPaymentOpen(true)}
              >
                Record a payment
              </Button>
            ) : undefined
          }
        >
          <StaffTable
            rows={rows}
            month={month}
            isLoading={ledger.isLoading}
            error={ledger.error}
            onRetry={() => void ledger.refetch()}
            onEdit={onEdit}
          />
          <Pagination
            meta={ledger.data?.meta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="staff"
          />
        </Card>

        {paymentOpen ? (
          <SalaryPaymentForm
            month={month}
            staff={rows}
            onClose={() => setPaymentOpen(false)}
          />
        ) : null}
      </PageBody>
    </>
  );
}

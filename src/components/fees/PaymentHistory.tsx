/**
 * "Payments received" - every fee payment logged against the selected month.
 *
 * The list, its order and its total all come from `GET /api/payments`; the card
 * only renders them. "Undo" reverses a row through the API, which deletes it
 * and writes the whole record to the audit log in one transaction.
 */
import { useState } from 'react';
import type { FeePaymentDto, MonthKey } from '@hostel/shared';
import { formatDateLabel, formatMonthLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, TableScroll } from '../common/Card';
import { Pagination } from '../common/Pagination';
import { useConfirm } from '../common/ConfirmProvider';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { useToast } from '../common/ToastProvider';
import { useDeletePayment, usePaymentList } from '../../hooks/useFees';
import { useMoney } from '../../hooks/useSettings';
import { usePermissions } from '../../auth/AuthProvider';
import { entries } from '../../utils/format';

/** The reference UI's default wording for a payment logged without a note. */
const DEFAULT_NOTE = 'Fee payment';

export interface PaymentHistoryProps {
  month: MonthKey;
  buildingId: string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function PaymentHistory({
  month,
  buildingId,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaymentHistoryProps): JSX.Element {
  const { money } = useMoney();
  const toast = useToast();
  const confirm = useConfirm();
  const { canManageRecords } = usePermissions();

  const query = usePaymentList({ month, buildingId, page, pageSize });
  const deletePayment = useDeletePayment();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const payments = query.data?.items ?? [];
  const monthLabel = formatMonthLabel(month);

  async function undo(payment: FeePaymentDto): Promise<void> {
    const confirmed = await confirm({
      title: 'Undo this payment?',
      message: `${money(payment.amount)} from ${payment.residentName} for ${formatMonthLabel(
        payment.billingMonth,
      )} will be reversed. The record is kept in the audit log.`,
      confirmLabel: 'Undo payment',
      tone: 'danger',
    });
    if (!confirmed) return;

    setPendingId(payment.id);
    try {
      await deletePayment.mutateAsync(payment.id);
      toast.success(`Reversed ${money(payment.amount)} from ${payment.residentName}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card
      title="Payments received"
      hint={query.data ? entries(query.data.meta.total) : undefined}
    >
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        errorTitle="Could not load the payments"
        isEmpty={payments.length === 0}
        skeleton={<TableSkeleton rows={4} columns={canManageRecords ? 5 : 4} />}
        empty={
          <EmptyState
            title={`No payments logged for ${monthLabel}`}
            message="Use the ledger above to record one."
          />
        }
      >
        <TableScroll>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Resident</th>
                <th className="r">Amount</th>
                <th>Note</th>
                {canManageRecords ? <th className="r" aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDateLabel(payment.paymentDate)}</td>
                  <td>
                    <div className="name">{payment.residentName}</div>
                    <div className="sub">{formatMonthLabel(payment.billingMonth)}</div>
                  </td>
                  <td className="r">{money(payment.amount)}</td>
                  <td>{payment.note ?? DEFAULT_NOTE}</td>
                  {canManageRecords ? (
                    <td>
                      <div className="inline-actions">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void undo(payment)}
                          loading={pendingId === payment.id}
                          disabled={pendingId !== null}
                        >
                          Undo
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        <Pagination
          meta={query.data?.meta}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          itemLabel="payments"
        />
      </QueryBoundary>
    </Card>
  );
}

/**
 * The right-hand column of the resident profile: what they owe, what they have
 * paid, and every month and payment behind those two numbers.
 *
 * Every figure below arrives from `GET /api/residents/:id/profile`. Balances,
 * statuses and arrears are the server's; the only arithmetic here is deciding
 * whether a balance is greater than zero so the row can offer "Mark paid".
 */
import { useMutation } from '@tanstack/react-query';
import type { MonthKey, ResidentProfileDto } from '@hostel/shared';
import { formatDateLabel, formatMonthLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, StatCard, StatGrid, TableScroll } from '../common/Card';
import { FeeStrip, FeeStripLegend, MonthStatusChip } from '../common/StatusChip';
import { EmptyState, ErrorState, Skeleton, errorMessage } from '../common/states';
import { useConfirm } from '../common/ConfirmProvider';
import { useToast } from '../common/ToastProvider';
import { paymentsApi } from '../../api/resources';
import { usePermissions } from '../../auth/AuthProvider';
import { useFilters } from '../../hooks/useFilters';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useResidentFeeStrip } from '../../hooks/useResidents';
import { useMoney } from '../../hooks/useSettings';
import { dueDayLabel, orDash, owedStyle, pluralise } from '../../utils/format';

export interface ResidentProfileProps {
  profile: ResidentProfileDto;
}

export function ResidentProfile({ profile }: ResidentProfileProps): JSX.Element {
  const { resident, totals, monthlyHistory, payments } = profile;
  const { year, stepYear } = useFilters();
  const { money } = useMoney();
  const permissions = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();
  const { financial, resident: invalidateResident } = useInvalidate();

  const strip = useResidentFeeStrip(resident.id, year);

  const settle = useMutation({
    // The browser sends who and which month; the server works out the amount.
    mutationFn: (billingMonth: MonthKey) =>
      paymentsApi.settle({ residentId: resident.id, billingMonth }),
    onSuccess: () => {
      financial();
      invalidateResident(resident.id);
    },
  });

  const undo = useMutation({
    mutationFn: (paymentId: string) => paymentsApi.remove(paymentId),
    onSuccess: () => {
      financial();
      invalidateResident(resident.id);
    },
  });

  const onSettle = async (month: MonthKey): Promise<void> => {
    try {
      await settle.mutateAsync(month);
      toast.success(`${formatMonthLabel(month)} marked as paid.`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onUndo = async (paymentId: string, amount: number, month: MonthKey): Promise<void> => {
    const ok = await confirm({
      title: 'Undo this payment?',
      message: `${money(amount)} recorded against ${formatMonthLabel(month)} will be removed. The change is written to the audit log.`,
      confirmLabel: 'Undo payment',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await undo.mutateAsync(paymentId);
      toast.success('Payment undone.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const statusLabel = !resident.active
    ? 'Archived'
    : resident.vacatedMonth
      ? `Vacated ${formatMonthLabel(resident.vacatedMonth)}`
      : 'Staying';

  const owes = totals.overdue.totalOverdue;
  const showSettle = permissions.canRecordTransactions;
  const showUndo = permissions.canManageRecords;

  return (
    <div className="stack">
      <StatGrid style={{ marginBottom: 0 }}>
        <StatCard
          eyebrow="Monthly rent"
          value={money(resident.monthlyFee)}
          foot={`due on the ${dueDayLabel(resident.dueDay)}`}
        />
        <StatCard
          eyebrow="Owes now"
          value={money(owes)}
          tone={owes > 0 ? 'late' : 'ok'}
          foot={
            totals.overdue.oldestUnpaidMonth
              ? `unpaid since ${formatMonthLabel(totals.overdue.oldestUnpaidMonth)}`
              : 'fully settled'
          }
        />
        <StatCard
          eyebrow="Paid to date"
          value={money(totals.totalPaid)}
          tone="ok"
          foot={pluralise(totals.paymentCount, 'payment')}
        />
      </StatGrid>

      <Card title="Contact & terms">
        <div className="deets">
          <div>
            <span>Phone</span>
            <b>{orDash(resident.phone)}</b>
          </div>
          <div>
            <span>Building</span>
            <b>{resident.buildingName}</b>
          </div>
          <div>
            <span>Joined</span>
            <b>{formatMonthLabel(resident.joinMonth)}</b>
          </div>
          <div>
            <span>Status</span>
            <b>{statusLabel}</b>
          </div>
          <div>
            <span>{formatMonthLabel(totals.currentMonth.month)}</span>
            <MonthStatusChip month={totals.currentMonth} />
          </div>
        </div>
      </Card>

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
        <div style={{ padding: '14px 16px' }}>
          {strip.isLoading ? (
            <Skeleton width="180px" height={17} />
          ) : strip.error ? (
            <ErrorState
              error={strip.error}
              onRetry={() => void strip.refetch()}
              title="Could not load the fee card"
            />
          ) : (
            <FeeStrip months={strip.data?.months ?? []} year={year} />
          )}
        </div>
        <FeeStripLegend />
      </Card>

      <Card title="Month by month">
        {monthlyHistory.length === 0 ? (
          <EmptyState
            title="No months to bill yet"
            message="Billing starts from the joining month."
          />
        ) : (
          <TableScroll>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="r">Rent</th>
                  <th className="r">Paid</th>
                  <th className="r">Balance</th>
                  <th>Status</th>
                  <th className="r">Settle</th>
                </tr>
              </thead>
              <tbody>
                {monthlyHistory.map((row) => (
                  <tr key={row.month}>
                    <td>{formatMonthLabel(row.month)}</td>
                    <td className="r num">{money(row.expected)}</td>
                    <td className="r num">{money(row.paid)}</td>
                    <td className="r num" style={owedStyle(row.balance)}>
                      {money(row.balance)}
                    </td>
                    <td>
                      <MonthStatusChip month={row} />
                    </td>
                    <td>
                      <div className="inline-actions">
                        {row.balance > 0 && showSettle ? (
                          <Button
                            size="sm"
                            loading={settle.isPending && settle.variables === row.month}
                            onClick={() => void onSettle(row.month)}
                          >
                            Mark paid
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Card title="Payment history">
        {payments.length === 0 ? (
          <EmptyState
            title="No payments recorded"
            message="Use the fee ledger to log the first one."
          />
        ) : (
          <TableScroll>
            <table>
              <thead>
                <tr>
                  <th>Paid on</th>
                  <th>For</th>
                  <th className="r">Amount</th>
                  <th>Note</th>
                  <th className="r" />
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateLabel(payment.paymentDate)}</td>
                    <td>{formatMonthLabel(payment.billingMonth)}</td>
                    <td className="r num">{money(payment.amount)}</td>
                    <td>{payment.note ?? 'Fee payment'}</td>
                    <td>
                      <div className="inline-actions">
                        {showUndo ? (
                          <Button
                            variant="danger"
                            size="sm"
                            loading={undo.isPending && undo.variables === payment.id}
                            onClick={() =>
                              void onUndo(payment.id, payment.amount, payment.billingMonth)
                            }
                          >
                            Undo
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}

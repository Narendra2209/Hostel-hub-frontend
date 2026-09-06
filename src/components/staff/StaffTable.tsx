/**
 * The salary register: one row per staff member for the selected month.
 *
 * Salary, paid, balance and status all arrive from the API - nothing on this
 * table adds anything up. "Full" does not send an amount either: the server
 * works out what is outstanding and records exactly that.
 */
import { useState, type KeyboardEvent } from 'react';
import type { MonthKey, StaffLedgerRowDto } from '@hostel/shared';
import { Button } from '../common/Button';
import { TableScroll } from '../common/Card';
import { SalaryStatusChip } from '../common/StatusChip';
import { useConfirm } from '../common/ConfirmProvider';
import { useToast } from '../common/ToastProvider';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { usePermissions } from '../../auth/AuthProvider';
import { useMoney } from '../../hooks/useSettings';
import { useArchiveStaff, useCreateSalaryPayment, useSettleSalary } from '../../hooks/useStaff';
import { orDash, owedStyle } from '../../utils/format';

type RowAction = 'add' | 'full' | 'remove';

export interface StaffTableProps {
  rows: StaffLedgerRowDto[];
  month: MonthKey;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onEdit: (staff: StaffLedgerRowDto) => void;
}

export function StaffTable({
  rows,
  month,
  isLoading,
  error,
  onRetry,
  onEdit,
}: StaffTableProps): JSX.Element {
  const { money } = useMoney();
  const { canRecordTransactions, canManageRecords } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();

  const createPayment = useCreateSalaryPayment();
  const settleSalary = useSettleSalary();
  const archiveStaff = useArchiveStaff();

  // Typed amounts and the in-flight action are tracked per row, so paying one
  // person never spins or blocks the buttons on another row.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<{ id: string; action: RowAction } | null>(null);

  const isBusy = (id: string, action: RowAction): boolean =>
    busy !== null && busy.id === id && busy.action === action;
  const rowLocked = (id: string): boolean => busy !== null && busy.id === id;

  const addPayment = async (row: StaffLedgerRowDto): Promise<void> => {
    const typed = (amounts[row.id] ?? '').trim();
    const amount = Number(typed);
    if (typed === '' || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount above zero');
      return;
    }

    setBusy({ id: row.id, action: 'add' });
    try {
      const payment = await createPayment.mutateAsync({
        staffId: row.id,
        salaryMonth: month,
        amount,
        paymentMethod: 'CASH',
      });
      setAmounts((current) => ({ ...current, [row.id]: '' }));
      toast.success(`${money(payment.amount)} paid to ${row.name}`);
    } catch (mutationError) {
      toast.error(errorMessage(mutationError));
    } finally {
      setBusy(null);
    }
  };

  const settleRow = async (row: StaffLedgerRowDto): Promise<void> => {
    setBusy({ id: row.id, action: 'full' });
    try {
      const payment = await settleSalary.mutateAsync({ staffId: row.id, salaryMonth: month });
      setAmounts((current) => ({ ...current, [row.id]: '' }));
      toast.success(`${money(payment.amount)} paid to ${row.name}`);
    } catch (mutationError) {
      toast.error(errorMessage(mutationError));
    } finally {
      setBusy(null);
    }
  };

  const removeRow = async (row: StaffLedgerRowDto): Promise<void> => {
    const confirmed = await confirm({
      title: `Remove ${row.name}?`,
      message:
        'They come off the salary register. If salary payments have already been recorded for them the record is archived instead of deleted, so past months still add up.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    setBusy({ id: row.id, action: 'remove' });
    try {
      const result = await archiveStaff.mutateAsync(row.id);
      toast.success(result.archived ? `${row.name} was archived` : `${row.name} was removed`);
    } catch (mutationError) {
      toast.error(errorMessage(mutationError));
    } finally {
      setBusy(null);
    }
  };

  const onAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>, row: StaffLedgerRowDto): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void addPayment(row);
  };

  return (
    <QueryBoundary
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={rows.length === 0}
      errorTitle="Could not load the salary register"
      skeleton={<TableSkeleton rows={5} columns={8} />}
      empty={
        <EmptyState
          title="No staff on the register"
          message="Add cook, warden or cleaning staff above."
        />
      }
    >
      <TableScroll>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Works at</th>
              <th className="r">Salary</th>
              <th className="r">Paid</th>
              <th className="r">Balance</th>
              <th>Status</th>
              <th className="r">Pay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Someone who has left keeps their row and their history, but the
              // pay controls disappear entirely - exactly as the reference did.
              const canPay = canRecordTransactions && row.status !== 'INACTIVE';
              return (
                <tr key={row.id}>
                  <td className="name">{row.name}</td>
                  <td>{orDash(row.role)}</td>
                  <td>{row.buildingName ?? 'All buildings'}</td>
                  <td className="r num">{money(row.salary)}</td>
                  <td className="r num">{money(row.paid)}</td>
                  <td className="r num" style={owedStyle(row.balance)}>
                    {money(row.balance)}
                  </td>
                  <td>
                    <SalaryStatusChip status={row.status} />
                  </td>
                  <td>
                    <div className="pay-inline">
                      {canPay ? (
                        <>
                          <input
                            className="num"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`Amount to pay ${row.name}`}
                            placeholder={money(row.balance)}
                            value={amounts[row.id] ?? ''}
                            disabled={rowLocked(row.id)}
                            onChange={(event) =>
                              setAmounts((current) => ({
                                ...current,
                                [row.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => onAmountKeyDown(event, row)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={isBusy(row.id, 'add')}
                            disabled={rowLocked(row.id)}
                            onClick={() => void addPayment(row)}
                          >
                            Add
                          </Button>
                          {row.balance > 0 ? (
                            <Button
                              size="sm"
                              loading={isBusy(row.id, 'full')}
                              disabled={rowLocked(row.id)}
                              onClick={() => void settleRow(row)}
                            >
                              Full
                            </Button>
                          ) : null}
                        </>
                      ) : null}

                      {canManageRecords ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={rowLocked(row.id)}
                            onClick={() => onEdit(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={isBusy(row.id, 'remove')}
                            disabled={rowLocked(row.id)}
                            onClick={() => void removeRow(row)}
                          >
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
    </QueryBoundary>
  );
}

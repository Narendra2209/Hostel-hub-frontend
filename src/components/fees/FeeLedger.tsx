/**
 * The month's fee ledger: one row per enrolled resident, with the inline
 * "record a payment" cell the reference UI used.
 *
 * Nothing on this table is calculated here. Rent, paid, balance, status and the
 * due date all arrive on `FeeLedgerRowDto`. "Add" posts the amount that was
 * typed (or, when the box is left empty, the balance the server already told us
 * about); "Full" posts no amount at all - `POST /payments/settle` derives it.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FeeLedgerResponseDto, FeeLedgerRowDto, MonthKey } from '@hostel/shared';
import { STATUS_LABELS, formatDayMonthLabel, formatMonthLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, TableScroll } from '../common/Card';
import { BuildingChip } from '../common/StatusChip';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { useToast } from '../common/ToastProvider';
import { PaymentForm } from './PaymentForm';
import { PaymentStatus } from './PaymentStatus';
import { useCreatePayment, useSettlePayment } from '../../hooks/useFees';
import { useMoney } from '../../hooks/useSettings';
import { usePermissions } from '../../auth/AuthProvider';
import { owedStyle } from '../../utils/format';

/** "All" plus the four statuses a resident on the ledger can actually be in. */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'PAID', label: STATUS_LABELS.PAID },
  { value: 'PART_PAID', label: STATUS_LABELS.PART_PAID },
  { value: 'OVERDUE', label: STATUS_LABELS.OVERDUE },
  { value: 'NOT_DUE', label: STATUS_LABELS.NOT_DUE },
];

const SEARCH_DEBOUNCE_MS = 250;

interface RowPending {
  residentId: string;
  action: 'add' | 'full';
}

export interface FeeLedgerProps {
  month: MonthKey;
  query: UseQueryResult<FeeLedgerResponseDto>;
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export function FeeLedger({
  month,
  query,
  search,
  status,
  onSearchChange,
  onStatusChange,
}: FeeLedgerProps): JSX.Element {
  const { money } = useMoney();
  const toast = useToast();
  const { canRecordTransactions } = usePermissions();
  const createPayment = useCreatePayment();
  const settlePayment = useSettlePayment();

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // Tracked per row, so recording one resident's rent never freezes the table.
  const [pending, setPending] = useState<RowPending | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // The search box types locally and settles into the URL, so a request is not
  // fired on every keystroke.
  const [draft, setDraft] = useState(search);
  const searchRef = useRef(onSearchChange);
  useEffect(() => {
    searchRef.current = onSearchChange;
  });
  useEffect(() => setDraft(search), [search]);
  useEffect(() => {
    if (draft === search) return;
    const timer = window.setTimeout(() => searchRef.current(draft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, search]);

  const rows = query.data?.rows ?? [];
  const monthLabel = formatMonthLabel(month);

  const setAmount = (residentId: string, value: string): void => {
    setAmounts((current) => ({ ...current, [residentId]: value }));
  };

  async function recordTyped(row: FeeLedgerRowDto): Promise<void> {
    const typed = (amounts[row.residentId] ?? '').trim();
    // An empty box means "the whole outstanding balance", exactly as the
    // reference behaved. That balance is the server's own figure.
    const amount = typed === '' ? row.balance : Number(typed);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount above zero.');
      return;
    }

    setPending({ residentId: row.residentId, action: 'add' });
    try {
      const payment = await createPayment.mutateAsync({
        residentId: row.residentId,
        billingMonth: month,
        amount,
        paymentMethod: 'CASH',
      });
      setAmount(row.residentId, '');
      toast.success(`Recorded ${money(payment.amount)} for ${payment.residentName}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  async function settleInFull(row: FeeLedgerRowDto): Promise<void> {
    setPending({ residentId: row.residentId, action: 'full' });
    try {
      const payment = await settlePayment.mutateAsync({
        residentId: row.residentId,
        billingMonth: month,
      });
      setAmount(row.residentId, '');
      toast.success(`Settled ${money(payment.amount)} for ${payment.residentName}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  const onAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>, row: FeeLedgerRowDto): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void recordTyped(row);
  };

  return (
    <Card
      title={`Fee ledger · ${monthLabel}`}
      hint="Type an amount and press Enter for part payments"
      actions={
        canRecordTransactions ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFormOpen(true)}
            disabled={rows.length === 0}
          >
            Record a payment
          </Button>
        ) : null
      }
    >
      <div className="filters">
        <input
          className="search"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search residents"
          aria-label="Search residents"
        />
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Fee status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        errorTitle="Could not load the fee ledger"
        isEmpty={rows.length === 0}
        skeleton={<TableSkeleton rows={6} columns={canRecordTransactions ? 7 : 6} />}
        empty={
          <EmptyState
            title={`Nobody enrolled here in ${monthLabel}`}
            message="Pick another month or building."
          />
        }
      >
        <TableScroll>
          <table>
            <thead>
              <tr>
                <th>Resident</th>
                <th>Building</th>
                <th className="r">Rent</th>
                <th className="r">Paid</th>
                <th className="r">Balance</th>
                <th>Status</th>
                {canRecordTransactions ? <th className="r">Record a payment</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = pending?.residentId === row.residentId ? pending.action : null;
                return (
                  <tr key={row.residentId}>
                    <td>
                      <div className="name">{row.residentName}</div>
                      <div className="sub">Due {formatDayMonthLabel(row.dueDate)}</div>
                    </td>
                    <td>
                      <BuildingChip name={row.buildingName} />
                    </td>
                    <td className="r">{money(row.expected)}</td>
                    <td className="r">{money(row.paid)}</td>
                    <td className="r" style={owedStyle(row.balance)}>
                      {money(row.balance)}
                    </td>
                    <td>
                      <PaymentStatus row={row} />
                    </td>
                    {canRecordTransactions ? (
                      <td>
                        <div className="pay-inline">
                          <input
                            className="num"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder={String(row.balance)}
                            aria-label={`Payment amount for ${row.residentName}`}
                            value={amounts[row.residentId] ?? ''}
                            onChange={(event) => setAmount(row.residentId, event.target.value)}
                            onKeyDown={(event) => onAmountKeyDown(event, row)}
                            disabled={busy !== null}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void recordTyped(row)}
                            loading={busy === 'add'}
                            disabled={busy !== null}
                          >
                            Add
                          </Button>
                          {row.balance > 0 ? (
                            <Button
                              size="sm"
                              onClick={() => void settleInFull(row)}
                              loading={busy === 'full'}
                              disabled={busy !== null}
                            >
                              Full
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </QueryBoundary>

      {canRecordTransactions ? (
        <PaymentForm open={formOpen} onClose={() => setFormOpen(false)} month={month} rows={rows} />
      ) : null}
    </Card>
  );
}

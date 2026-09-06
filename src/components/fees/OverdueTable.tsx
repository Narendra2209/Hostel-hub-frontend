/**
 * The two arrears tables.
 *
 * `OverdueTable` is the reference view - one row per unpaid billing month -
 * and `OverdueResidentTable` is the same arrears grouped per person. Every
 * figure (expected, paid, balance, daysOverdue, the month it belongs to) is
 * decided by the API; these components only choose the column order, the red
 * for money owed and the chip for how late it is.
 *
 * Settling is deliberately amount-free: `POST /payments/settle` works the
 * outstanding balance out server-side, so the browser can never post a figure
 * that disagrees with the ledger.
 */
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { MonthKey, OverdueResidentDto, OverdueRowDto } from '@hostel/shared';
import { formatMonthLabel } from '@hostel/shared';
import { paymentsApi } from '../../api/resources';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useMoney } from '../../hooks/useSettings';
import { EM_DASH, orDash, owedStyle } from '../../utils/format';
import { Button } from '../common/Button';
import { TableScroll } from '../common/Card';
import { BuildingChip } from '../common/StatusChip';
import { useToast } from '../common/ToastProvider';
import { errorMessage } from '../common/states';

/** The four orderings `GET /overdue` understands. */
export type OverdueSortKey = 'name' | 'month' | 'balance' | 'daysOverdue';

export interface OverdueSort {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onToggle: (column: OverdueSortKey) => void;
}

/* ------------------------------------------------------------------ *
 * Sortable column header
 * ------------------------------------------------------------------ */

// The `th` already carries the uppercase micro-type of the reference design;
// the button only has to stop looking like a button and inherit all of it.
const SORT_BUTTON: CSSProperties = {
  background: 'none',
  border: 0,
  margin: 0,
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

function SortHeader({
  column,
  label,
  sort,
  align,
}: {
  column: OverdueSortKey;
  label: string;
  sort: OverdueSort;
  align?: 'right';
}): JSX.Element {
  const active = sort.sortBy === column;
  const ascending = sort.sortOrder === 'asc';
  return (
    <th
      className={align === 'right' ? 'r' : undefined}
      aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" style={SORT_BUTTON} onClick={() => sort.onToggle(column)}>
        {label}
        {active ? (
          <span aria-hidden="true" style={{ fontSize: 8 }}>
            {ascending ? '▲' : '▼'}
          </span>
        ) : null}
      </button>
    </th>
  );
}

/* ------------------------------------------------------------------ *
 * One row per unpaid month - the reference table
 * ------------------------------------------------------------------ */

export interface OverdueTableProps {
  rows: OverdueRowDto[];
  sort: OverdueSort;
  /** The Settle column is hidden from anyone who may not record money. */
  canSettle: boolean;
}

interface SettleVariables {
  residentId: string;
  billingMonth: MonthKey;
  residentName: string;
}

export function OverdueTable({ rows, sort, canSettle }: OverdueTableProps): JSX.Element {
  const { money } = useMoney();
  const toast = useToast();
  const invalidate = useInvalidate();

  const settle = useMutation({
    mutationFn: (input: SettleVariables) =>
      paymentsApi.settle({ residentId: input.residentId, billingMonth: input.billingMonth }),
    onSuccess: (payment, input) => {
      toast.success(
        `${money(payment.amount)} recorded for ${input.residentName} · ${formatMonthLabel(
          input.billingMonth,
        )}`,
      );
      invalidate.financial();
      invalidate.resident(input.residentId);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const isSettling = (row: OverdueRowDto): boolean =>
    settle.isPending &&
    settle.variables?.residentId === row.residentId &&
    settle.variables?.billingMonth === row.month;

  return (
    <TableScroll>
      <table>
        <thead>
          <tr>
            <SortHeader column="name" label="Resident" sort={sort} />
            <th>Building</th>
            <th>Phone</th>
            <SortHeader column="month" label="For month" sort={sort} />
            <th className="r">Rent</th>
            <th className="r">Paid</th>
            <SortHeader column="balance" label="Due" sort={sort} align="right" />
            <SortHeader column="daysOverdue" label="Late by" sort={sort} />
            {canSettle ? <th className="r">Settle</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.residentId}-${row.month}`}>
              <td>
                <Link className="link" to={`/residents/${row.residentId}`}>
                  {row.residentName}
                </Link>
              </td>
              <td>
                <BuildingChip name={row.buildingName} />
              </td>
              <td>{orDash(row.phone)}</td>
              <td>{formatMonthLabel(row.month)}</td>
              <td className="r">{money(row.expected)}</td>
              <td className="r">{money(row.paid)}</td>
              <td className="r" style={owedStyle(row.balance)}>
                {money(row.balance)}
              </td>
              <td>
                <span className="chip late">{row.daysOverdue} days</span>
              </td>
              {canSettle ? (
                <td className="r">
                  <Button
                    size="sm"
                    loading={isSettling(row)}
                    disabled={settle.isPending}
                    aria-label={`Mark ${formatMonthLabel(row.month)} paid for ${row.residentName}`}
                    onClick={() =>
                      settle.mutate({
                        residentId: row.residentId,
                        billingMonth: row.month,
                        residentName: row.residentName,
                      })
                    }
                  >
                    Mark paid
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

/* ------------------------------------------------------------------ *
 * One row per resident
 * ------------------------------------------------------------------ */

export interface OverdueResidentTableProps {
  rows: OverdueResidentDto[];
  sort: OverdueSort;
}

export function OverdueResidentTable({ rows, sort }: OverdueResidentTableProps): JSX.Element {
  const { money } = useMoney();

  return (
    <TableScroll>
      <table>
        <thead>
          <tr>
            <SortHeader column="name" label="Resident" sort={sort} />
            <th>Building</th>
            <th>Phone</th>
            <SortHeader column="month" label="Unpaid from" sort={sort} />
            <th className="r">Months</th>
            <SortHeader column="balance" label="Total overdue" sort={sort} align="right" />
            <SortHeader column="daysOverdue" label="Longest overdue" sort={sort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.residentId}>
              <td>
                <Link className="link" to={`/residents/${row.residentId}`}>
                  {row.residentName}
                </Link>
              </td>
              <td>
                <BuildingChip name={row.buildingName} />
              </td>
              <td>{orDash(row.phone)}</td>
              <td>{row.oldestUnpaidMonth ? formatMonthLabel(row.oldestUnpaidMonth) : EM_DASH}</td>
              <td className="r num">{row.numberOfOverdueMonths}</td>
              <td className="r" style={owedStyle(row.totalOverdue)}>
                {money(row.totalOverdue)}
              </td>
              <td>
                <span className="chip late">{row.maxDaysOverdue} days</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

/**
 * Status chips and the Jan-Dec fee strip.
 *
 * The status itself is always computed by the backend (PaymentStatus); these
 * components only choose the class and the wording, exactly matching the
 * reference UI's `statusChip()` and `stripFor()`.
 */
import type { MonthFeeStatusDto, PaymentStatus } from '@hostel/shared';
import { MONTH_SHORT_LABELS } from '@hostel/shared';

const STRIP_CLASS: Record<PaymentStatus, string> = {
  PAID: 'paid',
  PART_PAID: 'part',
  OVERDUE: 'late',
  NOT_DUE: 'open',
  NOT_STAYING: 'na',
};

export interface StatusChipProps {
  status: PaymentStatus;
  daysOverdue?: number;
}

export function StatusChip({ status, daysOverdue = 0 }: StatusChipProps): JSX.Element {
  switch (status) {
    case 'PAID':
      return <span className="chip paid">Paid</span>;
    case 'PART_PAID':
      return <span className="chip part">Part paid</span>;
    case 'OVERDUE':
      return <span className="chip late">Overdue {daysOverdue}d</span>;
    case 'NOT_STAYING':
      return <span className="chip off">—</span>;
    default:
      return <span className="chip open">Not due yet</span>;
  }
}

/** Convenience wrapper when the whole month position is to hand. */
export function MonthStatusChip({ month }: { month: MonthFeeStatusDto }): JSX.Element {
  return <StatusChip status={month.status} daysOverdue={month.daysOverdue} />;
}

export function VacatedChip(): JSX.Element {
  return <span className="chip off">Vacated</span>;
}

export function BuildingChip({ name }: { name: string | null }): JSX.Element {
  return <span className="chip bld">{name ?? 'Shared'}</span>;
}

export type SalaryStatus = 'PAID' | 'PART_PAID' | 'PENDING' | 'INACTIVE';

export function SalaryStatusChip({
  status,
  balanceLabel,
}: {
  status: SalaryStatus;
  /** Shown inside the part-paid chip, e.g. "₹1,500 left". */
  balanceLabel?: string;
}): JSX.Element {
  switch (status) {
    case 'INACTIVE':
      return <span className="chip off">Left</span>;
    case 'PAID':
      return <span className="chip paid">Paid</span>;
    case 'PART_PAID':
      return <span className="chip part">{balanceLabel ? `${balanceLabel} left` : 'Part paid'}</span>;
    default:
      return <span className="chip open">Pending</span>;
  }
}

export interface FeeStripProps {
  months: { month: string; status: PaymentStatus }[];
  year: number;
}

/** Twelve cells, one per month, exactly as `stripFor()` rendered them. */
export function FeeStrip({ months, year }: FeeStripProps): JSX.Element {
  return (
    <div className="strip">
      {Array.from({ length: 12 }, (_, index) => {
        const key = `${year}-${String(index + 1).padStart(2, '0')}`;
        const entry = months.find((m) => m.month === key);
        const status: PaymentStatus = entry?.status ?? 'NOT_STAYING';
        return (
          <i
            key={key}
            className={STRIP_CLASS[status]}
            title={`${MONTH_SHORT_LABELS[index]} ${year}`}
          />
        );
      })}
    </div>
  );
}

/** The legend beneath the fee card, wording taken from the reference. */
export function FeeStripLegend(): JSX.Element {
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--rule-soft)' }}>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--ok)' }} />
          Paid in full
        </span>
        <span>
          <i style={{ background: 'var(--warn)' }} />
          Part paid
        </span>
        <span>
          <i style={{ background: 'var(--late)' }} />
          Overdue
        </span>
        <span>
          <i style={{ background: '#fff', border: '1px solid var(--rule)' }} />
          Not due yet
        </span>
        <span>
          <i style={{ background: '#E4EAEE' }} />
          Not staying
        </span>
      </div>
    </div>
  );
}

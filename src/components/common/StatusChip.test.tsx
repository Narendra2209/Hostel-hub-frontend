/**
 * The status chip and the Jan-Dec fee strip are the two places where a payment
 * status the backend computed turns into something a person can read. Getting
 * the class or the wording wrong silently misreports money, so every status is
 * pinned here.
 */
import { describe, expect, it } from 'vitest';
import type { MonthFeeStatusDto, PaymentStatus } from '@hostel/shared';
import { PAYMENT_STATUSES } from '@hostel/shared';
import { renderWithProviders } from '../../test/utils';
import { FeeStrip, MonthStatusChip, StatusChip } from './StatusChip';

const EM_DASH = '—';

/** The chip is the only `.chip` the harness renders. */
function chipIn(container: HTMLElement): HTMLElement {
  const chip = container.querySelector<HTMLElement>('.chip');
  if (!chip) throw new Error('no chip was rendered');
  return chip;
}

interface ChipCase {
  status: PaymentStatus;
  daysOverdue?: number;
  classes: string[];
  text: string;
}

const CHIP_CASES: ChipCase[] = [
  { status: 'PAID', classes: ['chip', 'paid'], text: 'Paid' },
  { status: 'PART_PAID', classes: ['chip', 'part'], text: 'Part paid' },
  { status: 'OVERDUE', daysOverdue: 17, classes: ['chip', 'late'], text: 'Overdue 17d' },
  { status: 'NOT_DUE', classes: ['chip', 'open'], text: 'Not due yet' },
  { status: 'NOT_STAYING', classes: ['chip', 'off'], text: EM_DASH },
];

describe('StatusChip', () => {
  it.each(CHIP_CASES)(
    '$status renders the $text chip with the right classes',
    ({ status, daysOverdue, classes, text }) => {
      const { container } = renderWithProviders(
        <StatusChip status={status} daysOverdue={daysOverdue} />,
      );

      const chip = chipIn(container);
      expect([...chip.classList]).toEqual(classes);
      expect(chip).toHaveTextContent(text);
    },
  );

  it('covers every PaymentStatus the API can return', () => {
    expect([...PAYMENT_STATUSES].sort()).toEqual(CHIP_CASES.map((c) => c.status).sort());
  });

  it('defaults an overdue chip to zero days when the count is missing', () => {
    const { container } = renderWithProviders(<StatusChip status="OVERDUE" />);

    expect(chipIn(container)).toHaveTextContent('Overdue 0d');
  });

  it('shows the day count only for OVERDUE, never for a paid month', () => {
    const { container } = renderWithProviders(<StatusChip status="PAID" daysOverdue={40} />);

    expect(chipIn(container).textContent).toBe('Paid');
  });

  it('MonthStatusChip passes the month position straight through', () => {
    const month: MonthFeeStatusDto = {
      month: '2026-03',
      expected: 3500,
      paid: 1000,
      balance: 2500,
      status: 'OVERDUE',
      dueDate: '2026-03-05',
      daysOverdue: 9,
      paymentCount: 1,
    };

    const { container } = renderWithProviders(<MonthStatusChip month={month} />);

    const chip = chipIn(container);
    expect([...chip.classList]).toEqual(['chip', 'late']);
    expect(chip).toHaveTextContent('Overdue 9d');
  });
});

describe('FeeStrip', () => {
  const MONTHS: { month: string; status: PaymentStatus }[] = [
    { month: '2026-01', status: 'PAID' },
    { month: '2026-02', status: 'PAID' },
    { month: '2026-03', status: 'PART_PAID' },
    { month: '2026-04', status: 'OVERDUE' },
    { month: '2026-05', status: 'NOT_DUE' },
    { month: '2026-06', status: 'NOT_STAYING' },
    // A different year must not bleed into this strip.
    { month: '2025-12', status: 'PAID' },
  ];

  const cells = (container: HTMLElement): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>('.strip i'));

  it('renders exactly twelve cells, one per month of the year', () => {
    const { container } = renderWithProviders(<FeeStrip months={MONTHS} year={2026} />);

    expect(cells(container)).toHaveLength(12);
  });

  it('maps each status to its strip class and falls back to "na" with no data', () => {
    const { container } = renderWithProviders(<FeeStrip months={MONTHS} year={2026} />);

    expect(cells(container).map((cell) => cell.className)).toEqual([
      'paid', // Jan
      'paid', // Feb
      'part', // Mar
      'late', // Apr
      'open', // May
      'na', // Jun - NOT_STAYING
      'na', // Jul onwards - no data at all
      'na',
      'na',
      'na',
      'na',
      'na', // Dec - the 2025 entry belongs to another year
    ]);
  });

  it('titles every cell with its month and year', () => {
    const { container } = renderWithProviders(<FeeStrip months={MONTHS} year={2026} />);

    expect(cells(container).map((cell) => cell.getAttribute('title'))).toEqual([
      'Jan 2026',
      'Feb 2026',
      'Mar 2026',
      'Apr 2026',
      'May 2026',
      'Jun 2026',
      'Jul 2026',
      'Aug 2026',
      'Sep 2026',
      'Oct 2026',
      'Nov 2026',
      'Dec 2026',
    ]);
  });

  it('renders twelve "not staying" cells for a resident with no months at all', () => {
    const { container } = renderWithProviders(<FeeStrip months={[]} year={2024} />);

    const classes = cells(container).map((cell) => cell.className);
    expect(classes).toHaveLength(12);
    expect(new Set(classes)).toEqual(new Set(['na']));
  });
});

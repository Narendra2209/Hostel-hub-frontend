/**
 * Overview is the screen the application opens on, and it is fed by exactly one
 * request. These tests mock that request at the module boundary - no network,
 * no axios - and check the three states the screen has to survive, plus the two
 * product rules that are easy to regress:
 *
 *  - never paint a zero while the figures are still loading, because "₹0
 *    collected" and "still fetching" must not look the same;
 *  - the building-by-building cross-tab only means something while every
 *    building is in scope.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BuildingDto, DashboardDto, SettingsDto } from '@hostel/shared';
import { deferred, renderWithProviders, textNodesIn } from '../test/utils';
import { OverviewPage } from './OverviewPage';

vi.mock('../api/resources', async () => {
  const { createMockApi } = await import('../test/utils');
  return createMockApi();
});

// Mocked above - these are the vi.fn()s the screen will call.
import { buildingsApi, dashboardApi, settingsApi } from '../api/resources';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const SETTINGS: SettingsDto = {
  id: 'settings',
  hostelName: 'Green Valley Hostel',
  currency: '₹',
  currencyCode: 'INR',
  defaultDueDay: 5,
  timezone: 'Asia/Kolkata',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const building = (id: string, name: string, sortOrder: number): BuildingDto => ({
  id,
  name,
  code: null,
  address: null,
  active: true,
  sortOrder,
  residentCount: 21,
  totalResidentCount: 25,
  staffCount: 2,
  expenseCount: 4,
  deletable: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const BUILDINGS: BuildingDto[] = [
  building('bld-1', 'Sunrise Block', 1),
  building('bld-2', 'Riverside Block', 2),
];

const DASHBOARD: DashboardDto = {
  month: '2026-08',
  buildingId: null,
  buildingName: 'All buildings',
  buildingCount: 3,
  residentCount: 42,
  expectedFees: 150000,
  collectedFees: 120000,
  outstandingThisMonth: 30000,
  overdueAllMonths: 47500,
  overdueResidentCount: 2,
  salaryPaid: 45000,
  expenses: 17000,
  totalSpent: 62000,
  net: 58000,
  buildingSummary: [
    {
      buildingId: 'bld-1',
      buildingName: 'Sunrise Block',
      shared: false,
      residentCount: 25,
      billed: 90000,
      collected: 75000,
      overdue: 15000,
      bills: 9000,
      salaries: 20000,
      net: 46000,
    },
    {
      buildingId: 'bld-2',
      buildingName: 'Riverside Block',
      shared: false,
      residentCount: 17,
      billed: 60000,
      collected: 45000,
      overdue: 32500,
      bills: 8000,
      salaries: 25000,
      net: 12000,
    },
  ],
  buildingSummaryTotals: {
    residentCount: 42,
    billed: 150000,
    collected: 120000,
    overdue: 47500,
    bills: 17000,
    salaries: 45000,
    net: 58000,
  },
  overdueResidents: [
    {
      residentId: 'res-1',
      residentName: 'Anita Rao',
      phone: '9876543210',
      buildingId: 'bld-1',
      buildingName: 'Sunrise Block',
      totalOverdue: 32500,
      oldestUnpaidMonth: '2026-05',
      numberOfOverdueMonths: 3,
      maxDaysOverdue: 96,
    },
  ],
  overdueResidentTotal: 2,
  expenseBreakdown: [
    { categoryId: 'cat-1', categoryName: 'Electricity', amount: 11000, share: 65 },
    { categoryId: 'cat-2', categoryName: 'Water', amount: 6000, share: 35 },
  ],
  salarySummary: [
    {
      staffId: 'stf-1',
      name: 'Lakshmi',
      role: 'Cook',
      buildingId: 'bld-1',
      buildingName: 'Sunrise Block',
      salary: 14000,
      paid: 14000,
      balance: 0,
      status: 'PAID',
    },
  ],
  feeStrips: [
    {
      residentId: 'res-1',
      year: 2026,
      months: [{ month: '2026-08', status: 'OVERDUE', balance: 3500 }],
    },
  ],
  feeStripResidents: [
    {
      residentId: 'res-1',
      name: 'Anita Rao',
      buildingName: 'Sunrise Block',
      monthlyFee: 3500,
    },
  ],
  feeStripYear: 2026,
  feeStripTruncated: false,
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

interface Tile {
  eyebrow: string;
  value: string;
  foot: string;
}

/** The six headline tiles, in the order they are painted. */
function statTiles(): Tile[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.stats .stat')).map((tile) => ({
    eyebrow: tile.querySelector('.eyebrow')?.textContent ?? '',
    value: tile.querySelector('b')?.textContent ?? '',
    foot: tile.querySelector('.foot')?.textContent ?? '',
  }));
}

/**
 * Several of the payload's figures legitimately appear twice on the page (a
 * building total and the tile above it), so the suite waits on the tile row
 * rather than on a number. The skeleton occupies six `.stat` cards of its own,
 * so "settled" means six cards that actually carry an eyebrow.
 */
async function awaitStatTiles(): Promise<Tile[]> {
  await waitFor(() =>
    expect(document.querySelectorAll('.stats .stat .eyebrow')).toHaveLength(6),
  );
  return statTiles();
}

/** "0", "₹0", "-0", "0.00" - any figure that would read as a real zero. */
const ZERO_LIKE = /^[-−+]?[₹$€£]?\s*0(?:[.,]0+)?$/;

const zeroFiguresOnScreen = (): string[] =>
  textNodesIn(document.body).filter(
    (text) => ZERO_LIKE.test(text) || /[₹$€£]\s*0(?!\d)/.test(text),
  );

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.mocked(dashboardApi.get).mockReset();
    vi.mocked(buildingsApi.list).mockReset();
    vi.mocked(settingsApi.get).mockReset();
    vi.mocked(buildingsApi.list).mockResolvedValue(BUILDINGS);
    vi.mocked(settingsApi.get).mockResolvedValue(SETTINGS);
  });

  describe('while the dashboard is loading', () => {
    it('shows a skeleton in place of every figure', async () => {
      const pending = deferred<DashboardDto>();
      vi.mocked(dashboardApi.get).mockReturnValue(pending.promise);

      const { container } = renderWithProviders(<OverviewPage />, {
        path: '/',
        searchParams: { month: '2026-08' },
      });

      expect(screen.getByText('Loading figures…')).toBeInTheDocument();
      const tiles = container.querySelectorAll('.stats .stat');
      expect(tiles).toHaveLength(6);
      for (const tile of tiles) {
        expect(tile.querySelector('.skel')).not.toBeNull();
        expect(tile.querySelector('.eyebrow')).toBeNull();
      }
      expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(1);

      pending.resolve(DASHBOARD);
      await awaitStatTiles();
    });

    it('paints no zero anywhere on the screen', async () => {
      const pending = deferred<DashboardDto>();
      vi.mocked(dashboardApi.get).mockReturnValue(pending.promise);

      renderWithProviders(<OverviewPage />, { path: '/', searchParams: { month: '2026-08' } });

      // The product rule: a manager must never read "₹0 collected" and wonder
      // whether the money is missing or the request is.
      expect(zeroFiguresOnScreen()).toEqual([]);
      expect(screen.queryByText('₹0')).not.toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();

      // …and the zeros are only withheld, not lost: they arrive with the data.
      // Resolving with a genuine zero also proves the scan above can see one.
      pending.resolve({ ...DASHBOARD, outstandingThisMonth: 0 });
      expect(await screen.findByText('₹0')).toBeInTheDocument();
      expect(zeroFiguresOnScreen()).toContain('₹0');
    });
  });

  describe('once the dashboard arrives', () => {
    it('shows the six headline tiles from the payload', async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue(DASHBOARD);

      renderWithProviders(<OverviewPage />, { path: '/', searchParams: { month: '2026-08' } });

      expect(await awaitStatTiles()).toEqual([
        { eyebrow: 'Residents', value: '42', foot: 'across 3 buildings' },
        {
          eyebrow: 'Collected · Aug 2026',
          value: '₹1,20,000',
          foot: 'of ₹1,50,000 billed',
        },
        { eyebrow: 'Still to collect', value: '₹30,000', foot: 'this month only' },
        {
          eyebrow: 'Overdue, all months',
          value: '₹47,500',
          foot: '2 residents past due date',
        },
        {
          eyebrow: 'Spent · Aug 2026',
          value: '₹62,000',
          foot: '₹45,000 salaries · ₹17,000 bills',
        },
        { eyebrow: 'Net for the month', value: '₹58,000', foot: 'collected minus spent' },
      ]);
    });

    it('asks the API for the filtered scope, once for the whole screen', async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue(DASHBOARD);

      renderWithProviders(<OverviewPage />, {
        path: '/',
        searchParams: { month: '2026-08', building: 'bld-1' },
      });

      await awaitStatTiles();
      expect(dashboardApi.get).toHaveBeenCalledExactlyOnceWith({
        month: '2026-08',
        buildingId: 'bld-1',
        year: 2026,
        stripLimit: 15,
      });
    });
  });

  describe('when the request fails', () => {
    it('shows an error state and refetches from its retry control', async () => {
      const user = userEvent.setup();
      vi.mocked(dashboardApi.get)
        .mockRejectedValueOnce(new Error('The hostel API is unreachable.'))
        .mockResolvedValue(DASHBOARD);

      renderWithProviders(<OverviewPage />, { path: '/', searchParams: { month: '2026-08' } });

      const heading = await screen.findByText('The overview did not load');
      const errorState = heading.closest('.error-state');
      expect(errorState).not.toBeNull();
      expect(errorState).toHaveAttribute('role', 'alert');
      expect(within(errorState as HTMLElement).getByText('The hostel API is unreachable.')).toBeInTheDocument();
      expect(statTiles()).toEqual([]);

      await user.click(within(errorState as HTMLElement).getByRole('button', { name: 'Try again' }));

      await awaitStatTiles();
      expect(dashboardApi.get).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('The overview did not load')).not.toBeInTheDocument();
    });
  });

  describe('the building-by-building table', () => {
    it('is shown while every building is in scope', async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue(DASHBOARD);

      renderWithProviders(<OverviewPage />, { path: '/', searchParams: { month: '2026-08' } });

      // The card's heading is painted while it loads; wait for its contents.
      expect(await screen.findByRole('columnheader', { name: 'Billed' })).toBeInTheDocument();
      expect(screen.getByText('Building by building · Aug 2026')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sunrise Block' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Riverside Block' })).toBeInTheDocument();

      const sunrise = screen.getByRole('button', { name: 'Sunrise Block' }).closest('tr');
      expect(sunrise).not.toBeNull();
      expect(
        Array.from((sunrise as HTMLTableRowElement).cells).map((cell) => cell.textContent),
      ).toEqual([
        'Sunrise Block',
        '25',
        '₹90,000',
        '₹75,000',
        '₹15,000',
        '₹9,000',
        '₹20,000',
        '₹46,000',
      ]);
    });

    it('is hidden when a single building is selected', async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue({
        ...DASHBOARD,
        buildingId: 'bld-1',
        buildingName: 'Sunrise Block',
      });

      renderWithProviders(<OverviewPage />, {
        path: '/',
        searchParams: { month: '2026-08', building: 'bld-1' },
      });

      await awaitStatTiles();
      expect(screen.queryByText(/^Building by building/)).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Billed' })).not.toBeInTheDocument();
      // The tiles still narrow to the chosen building.
      await waitFor(() =>
        expect(statTiles()[0]).toEqual({
          eyebrow: 'Residents',
          value: '42',
          foot: 'in Sunrise Block',
        }),
      );
    });
  });
});

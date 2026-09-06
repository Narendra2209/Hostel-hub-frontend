/**
 * The dark navigation rail.
 *
 * The two counter badges (residents staying, residents overdue) come from a
 * single cheap API call rather than the full dashboard payload, so they stay
 * accurate on every screen without refetching a report.
 */
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { overdueApi } from '../../api/resources';
import { queryKeys } from '../../api/queryKeys';
import { useAuth, usePermissions } from '../../auth/AuthProvider';
import { useFilters } from '../../hooks/useFilters';
import { useSettings } from '../../hooks/useSettings';

interface NavItem {
  to: string;
  label: string;
  badge?: 'residents' | 'overdue';
  end?: boolean;
  /**
   * Capability this link needs. Absent means everyone who can sign in sees it;
   * the two developer views are hidden from a MANAGER or a VIEWER entirely.
   * Hiding a link is a courtesy, not a control - the API refuses regardless.
   */
  capability?: 'activityLog' | 'diagnostics';
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', end: true },
  { to: '/residents', label: 'Residents', badge: 'residents' },
  { to: '/fees', label: 'Fee ledger' },
  { to: '/overdue', label: 'Overdue', badge: 'overdue' },
  { to: '/staff', label: 'Staff & salaries' },
  { to: '/expenses', label: 'Bills & expenses' },
  { to: '/profit-loss', label: 'Profit & loss' },
  { to: '/settings', label: 'Settings' },
  { to: '/activity', label: 'Activity', capability: 'activityLog' },
  { to: '/diagnostics', label: 'Diagnostics', capability: 'diagnostics' },
];

function useNavCounts(buildingId: string) {
  return useQuery({
    queryKey: queryKeys.overdue.list({ buildingId, nav: true }),
    queryFn: () => overdueApi.byResident({ buildingId, page: 1, pageSize: 1 }),
    staleTime: 60_000,
    select: (result) => ({
      staying: result.meta?.totals?.stayingResidentCount ?? null,
      overdue: result.meta?.totals?.residentCount ?? null,
    }),
  });
}

export function Sidebar(): JSX.Element {
  const { buildingId, month } = useFilters();
  const { data: settings } = useSettings();
  const { user, signOut } = useAuth();
  const { canViewActivityLog, canViewDiagnostics } = usePermissions();
  const { data: counts } = useNavCounts(buildingId);

  const items = NAV_ITEMS.filter((item) => {
    if (item.capability === 'activityLog') return canViewActivityLog;
    if (item.capability === 'diagnostics') return canViewDiagnostics;
    return true;
  });

  // Carry the current month/building through so navigation keeps the context.
  const search = `?month=${month}${buildingId !== 'all' ? `&building=${buildingId}` : ''}`;

  const badgeValue = (badge: NavItem['badge']): string | null => {
    if (!badge || !counts) return null;
    const value = badge === 'residents' ? counts.staying : counts.overdue;
    return value === null ? null : String(value);
  };

  return (
    <aside className="rail">
      <div className="brand">
        <div className="mark">{settings?.hostelName ?? 'Hostel Manager'}</div>
        <div className="sub">Fees &amp; running costs</div>
      </div>

      <nav className="nav" aria-label="Main">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={{ pathname: item.to, search }}
            end={item.end}
            className={({ isActive }) => (isActive ? 'on' : undefined)}
          >
            <span>{item.label}</span>
            {badgeValue(item.badge) !== null ? (
              <span className="tag">{badgeValue(item.badge)}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {user ? (
        <div className="rail-user">
          <span className="who" title={user.email}>
            {user.name}
          </span>
          <span className="role-badge">{user.role}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : null}

      <div className="rail-foot">Changes are securely saved to the hostel database.</div>
    </aside>
  );
}

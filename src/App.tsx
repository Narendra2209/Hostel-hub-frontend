/**
 * Routing.
 *
 * Filters live in the query string (`?month=2026-08&building=<id>`), so each
 * route is a plain path and every view is shareable and refresh-safe.
 */
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Each screen is its own chunk; the overview is the only one most sessions load.
const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const ResidentsPage = lazy(() =>
  import('./pages/ResidentsPage').then((m) => ({ default: m.ResidentsPage })),
);
const ResidentProfilePage = lazy(() =>
  import('./pages/ResidentProfilePage').then((m) => ({ default: m.ResidentProfilePage })),
);
const FeeLedgerPage = lazy(() =>
  import('./pages/FeeLedgerPage').then((m) => ({ default: m.FeeLedgerPage })),
);
const OverduePage = lazy(() =>
  import('./pages/OverduePage').then((m) => ({ default: m.OverduePage })),
);
const StaffPage = lazy(() => import('./pages/StaffPage').then((m) => ({ default: m.StaffPage })));
const ExpensesPage = lazy(() =>
  import('./pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
);
const ProfitLossPage = lazy(() =>
  import('./pages/ProfitLossPage').then((m) => ({ default: m.ProfitLossPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
// Both are permission-gated inside: the sidebar hides the links, and the page
// itself renders the standard error panel when the capability is missing.
const ActivityPage = lazy(() =>
  import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })),
);
const DiagnosticsPage = lazy(() =>
  import('./pages/DiagnosticsPage').then((m) => ({ default: m.DiagnosticsPage })),
);

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="residents" element={<ResidentsPage />} />
        <Route path="residents/:residentId" element={<ResidentProfilePage />} />
        <Route path="fees" element={<FeeLedgerPage />} />
        <Route path="overdue" element={<OverduePage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="profit-loss" element={<ProfitLossPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        {/* The reference app called this view "Profit & loss"; keep an alias. */}
        <Route path="pnl" element={<Navigate to="/profit-loss" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

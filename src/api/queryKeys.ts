/**
 * Every React Query cache key in one place.
 *
 * Mutations invalidate by prefix, so a payment being recorded refreshes the
 * ledger, the dashboard, the overdue list, the resident's profile and the P&L
 * without any screen needing to know about the others.
 */
import type { MonthKey } from '@hostel/shared';

export interface MonthBuildingScope {
  month: MonthKey;
  buildingId: string;
}

export const queryKeys = {
  me: ['me'] as const,

  auth: {
    all: ['auth'] as const,
    status: () => ['auth', 'status'] as const,
  },

  settings: ['settings'] as const,

  buildings: {
    all: ['buildings'] as const,
    list: () => ['buildings', 'list'] as const,
    detail: (id: string) => ['buildings', 'detail', id] as const,
  },

  categories: {
    all: ['expense-categories'] as const,
    list: () => ['expense-categories', 'list'] as const,
  },

  residents: {
    all: ['residents'] as const,
    list: (params: Record<string, unknown>) => ['residents', 'list', params] as const,
    detail: (id: string) => ['residents', 'detail', id] as const,
    profile: (id: string, month: MonthKey) => ['residents', 'profile', id, month] as const,
    payments: (id: string, params: Record<string, unknown>) =>
      ['residents', 'payments', id, params] as const,
    feeStatus: (id: string, year: number) => ['residents', 'fee-status', id, year] as const,
    feeStatusBatch: (params: Record<string, unknown>) =>
      ['residents', 'fee-status-batch', params] as const,
  },

  fees: {
    all: ['fees'] as const,
    ledger: (params: Record<string, unknown>) => ['fees', 'ledger', params] as const,
  },

  payments: {
    all: ['payments'] as const,
    list: (params: Record<string, unknown>) => ['payments', 'list', params] as const,
    detail: (id: string) => ['payments', 'detail', id] as const,
  },

  overdue: {
    all: ['overdue'] as const,
    list: (params: Record<string, unknown>) => ['overdue', 'list', params] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
    view: (params: Record<string, unknown>) => ['dashboard', 'view', params] as const,
  },

  staff: {
    all: ['staff'] as const,
    list: (params: Record<string, unknown>) => ['staff', 'list', params] as const,
    detail: (id: string) => ['staff', 'detail', id] as const,
  },

  salaries: {
    all: ['salaries'] as const,
    list: (params: Record<string, unknown>) => ['salaries', 'list', params] as const,
  },

  expenses: {
    all: ['expenses'] as const,
    list: (params: Record<string, unknown>) => ['expenses', 'list', params] as const,
    detail: (id: string) => ['expenses', 'detail', id] as const,
  },

  reports: {
    all: ['reports'] as const,
    pnl: (params: Record<string, unknown>) => ['reports', 'pnl', params] as const,
  },

  documents: {
    all: ['documents'] as const,
    forResident: (residentId: string, kind: string) =>
      ['documents', residentId, kind] as const,
  },

  users: {
    all: ['users'] as const,
    list: (params: Record<string, unknown>) => ['users', 'list', params] as const,
  },

  auditLogs: {
    all: ['audit-logs'] as const,
    list: (params: Record<string, unknown>) => ['audit-logs', 'list', params] as const,
  },

  activity: {
    all: ['activity'] as const,
    list: (params: Record<string, unknown>) => ['activity', 'list', params] as const,
  },

  /** A live snapshot, so it is deliberately not scoped by any filter. */
  diagnostics: {
    all: ['diagnostics'] as const,
    snapshot: () => ['diagnostics', 'snapshot'] as const,
  },
} as const;

/**
 * Key prefixes whose data is derived from the fee ledger. Any change to a
 * payment, a resident or a building invalidates all of them.
 */
export const FINANCIAL_KEYS: readonly (readonly string[])[] = [
  queryKeys.dashboard.all,
  queryKeys.fees.all,
  queryKeys.overdue.all,
  queryKeys.payments.all,
  queryKeys.residents.all,
  queryKeys.reports.all,
];

/** Prefixes affected by a change to staff or salary payments. */
export const PAYROLL_KEYS: readonly (readonly string[])[] = [
  queryKeys.dashboard.all,
  queryKeys.staff.all,
  queryKeys.salaries.all,
  queryKeys.reports.all,
];

/** Prefixes affected by a change to an expense. */
export const EXPENSE_KEYS: readonly (readonly string[])[] = [
  queryKeys.dashboard.all,
  queryKeys.expenses.all,
  queryKeys.reports.all,
];

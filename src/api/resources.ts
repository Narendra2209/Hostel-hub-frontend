/**
 * Typed wrappers for every REST endpoint, grouped by resource.
 *
 * Each resource is re-exported from its own `*.api.ts` module so imports read
 * naturally (`import { residentsApi } from '@/api/residents.api'`), while the
 * definitions live together here - they are one-liners over the shared client
 * and keeping them adjacent makes the whole API surface reviewable at a glance.
 */
import type {
  ActivityEntryDto,
  ActivityListMeta,
  AuditLogDto,
  AuthStatusDto,
  BootstrapInput,
  BuildingDto,
  ChangePasswordInput,
  CreateBuildingInput,
  CreateExpenseInput,
  CreatePaymentInput,
  CreateResidentInput,
  CreateSalaryPaymentInput,
  CreateStaffInput,
  CurrentUserDto,
  DashboardDto,
  DiagnosticsDto,
  DocumentKind,
  ExpenseCategoryDto,
  ExpenseDto,
  ExpenseListMeta,
  FeeLedgerResponseDto,
  InvitedUserDto,
  InviteUserInput,
  LoginInput,
  LoginResponseDto,
  FeePaymentDto,
  FeeStatusStripDto,
  MonthKey,
  MoveResidentInput,
  OverdueResidentDto,
  OverdueResponseMeta,
  OverdueRowDto,
  PaginationMeta,
  PnlResponseDto,
  ResidentDto,
  ResidentListMeta,
  ResidentListRowDto,
  ResidentProfileDto,
  SalaryPaymentDto,
  SettingsDto,
  StaffLedgerResponseDto,
  StaffDto,
  UpdateBuildingInput,
  UpdateExpenseInput,
  UpdatePaymentInput,
  UpdateResidentInput,
  UpdateSalaryPaymentInput,
  UpdateSettingsInput,
  UpdateStaffInput,
  UserDto,
  UserRole,
  VacateResidentInput,
} from '@hostel/shared';
import {
  apiDelete,
  apiDownload,
  apiGet,
  apiGetPaged,
  apiPatch,
  apiPost,
  fetchDocumentObjectUrl,
  uploadFile,
  type Paged,
} from './client';

/* ------------------------------------------------------------------ *
 * Identity & settings
 * ------------------------------------------------------------------ */

export const meApi = {
  get: () => apiGet<CurrentUserDto>('/me'),
};

export const authApi = {
  /** Public: tells the login screen whether the first owner still needs creating. */
  status: () => apiGet<AuthStatusDto>('/auth/status'),
  /** Public, and only works while no user exists. Creates the first OWNER. */
  bootstrap: (input: BootstrapInput) => apiPost<LoginResponseDto>('/auth/bootstrap', input),
  login: (input: LoginInput) => apiPost<LoginResponseDto>('/auth/login', input),
  logout: () => apiPost<void>('/auth/logout'),
  /** Returns a fresh token, because changing a password ends every other session. */
  changePassword: (input: ChangePasswordInput) =>
    apiPost<LoginResponseDto>('/auth/change-password', input),
};

export const settingsApi = {
  get: () => apiGet<SettingsDto>('/settings'),
  update: (input: UpdateSettingsInput) => apiPatch<SettingsDto>('/settings', input),
};

export const usersApi = {
  list: (params: { page?: number; pageSize?: number; search?: string } = {}) =>
    apiGetPaged<UserDto, PaginationMeta>('/users', params),
  /** Creates the account and returns a one-time temporary password. */
  invite: (input: InviteUserInput) => apiPost<InvitedUserDto>('/users', input),
  update: (id: string, input: { name?: string; role?: UserRole; active?: boolean }) =>
    apiPatch<UserDto>(`/users/${id}`, input),
  resetPassword: (id: string, input: { newPassword?: string } = {}) =>
    apiPost<InvitedUserDto>(`/users/${id}/reset-password`, input),
};

/* ------------------------------------------------------------------ *
 * Buildings & categories
 * ------------------------------------------------------------------ */

export const buildingsApi = {
  list: () => apiGet<BuildingDto[]>('/buildings'),
  get: (id: string) => apiGet<BuildingDto>(`/buildings/${id}`),
  create: (input: CreateBuildingInput) => apiPost<BuildingDto>('/buildings', input),
  update: (id: string, input: UpdateBuildingInput) =>
    apiPatch<BuildingDto>(`/buildings/${id}`, input),
  remove: (id: string) => apiDelete<{ id: string }>(`/buildings/${id}`),
};

export const categoriesApi = {
  list: () => apiGet<ExpenseCategoryDto[]>('/expense-categories'),
  create: (input: { name: string; sortOrder?: number }) =>
    apiPost<ExpenseCategoryDto>('/expense-categories', input),
  update: (id: string, input: { name?: string; active?: boolean; sortOrder?: number }) =>
    apiPatch<ExpenseCategoryDto>(`/expense-categories/${id}`, input),
  remove: (id: string) => apiDelete<{ id: string }>(`/expense-categories/${id}`),
};

/* ------------------------------------------------------------------ *
 * Residents
 * ------------------------------------------------------------------ */

export type ResidentListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  buildingId?: string;
  month?: MonthKey;
  status?: 'all' | 'staying' | 'vacated' | 'archived';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeFees?: boolean;
}

export const residentsApi = {
  list: (params: ResidentListParams) =>
    apiGetPaged<ResidentListRowDto, ResidentListMeta>('/residents', params),
  get: (id: string) => apiGet<ResidentDto>(`/residents/${id}`),
  profile: (id: string, month?: MonthKey) =>
    apiGet<ResidentProfileDto>(`/residents/${id}/profile`, { month }),
  create: (input: CreateResidentInput) => apiPost<ResidentDto>('/residents', input),
  update: (id: string, input: UpdateResidentInput) =>
    apiPatch<ResidentDto>(`/residents/${id}`, input),
  remove: (id: string) =>
    apiDelete<{ id: string; archived: boolean }>(`/residents/${id}`),
  move: (id: string, input: MoveResidentInput) =>
    apiPost<ResidentDto>(`/residents/${id}/move`, input),
  vacate: (id: string, input: VacateResidentInput) =>
    apiPost<ResidentDto>(`/residents/${id}/vacate`, input),
  payments: (id: string, params: { page?: number; pageSize?: number } = {}) =>
    apiGetPaged<FeePaymentDto, PaginationMeta>(`/residents/${id}/payments`, params),
  feeStatus: (id: string, year: number) =>
    apiGet<FeeStatusStripDto>(`/residents/${id}/fee-status`, { year }),
  /** Batch strip endpoint - one request for a whole table, never one per row. */
  feeStatusBatch: (params: {
    year: number;
    buildingId?: string;
    residentIds?: string[];
    limit?: number;
  }) => apiGet<FeeStatusStripDto[]>('/residents/fee-status', params),
};

/* ------------------------------------------------------------------ *
 * Fees & payments
 * ------------------------------------------------------------------ */

export type FeeLedgerParams = {
  month?: MonthKey;
  buildingId?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const feesApi = {
  ledger: (params: FeeLedgerParams) => apiGet<FeeLedgerResponseDto>('/fees', params),
};

export type PaymentListParams = {
  page?: number;
  pageSize?: number;
  month?: MonthKey;
  buildingId?: string;
  residentId?: string;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const paymentsApi = {
  list: (params: PaymentListParams) =>
    apiGetPaged<FeePaymentDto, PaginationMeta>('/payments', params),
  get: (id: string) => apiGet<FeePaymentDto>(`/payments/${id}`),
  create: (input: CreatePaymentInput) => apiPost<FeePaymentDto>('/payments', input),
  update: (id: string, input: UpdatePaymentInput) =>
    apiPatch<FeePaymentDto>(`/payments/${id}`, input),
  remove: (id: string) => apiDelete<{ id: string; reversed: boolean }>(`/payments/${id}`),
  /** The server works out the outstanding balance; the browser never sends it. */
  settle: (input: { residentId: string; billingMonth: MonthKey; note?: string }) =>
    apiPost<FeePaymentDto>('/payments/settle', input),
};

/* ------------------------------------------------------------------ *
 * Overdue
 * ------------------------------------------------------------------ */

export type OverdueParams = {
  page?: number;
  pageSize?: number;
  buildingId?: string;
  search?: string;
  groupBy?: 'month' | 'resident';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const overdueApi = {
  byMonth: (params: OverdueParams): Promise<Paged<OverdueRowDto, OverdueResponseMeta>> =>
    apiGetPaged<OverdueRowDto, OverdueResponseMeta>('/overdue', { ...params, groupBy: 'month' }),
  byResident: (
    params: OverdueParams,
  ): Promise<Paged<OverdueResidentDto, OverdueResponseMeta>> =>
    apiGetPaged<OverdueResidentDto, OverdueResponseMeta>('/overdue', {
      ...params,
      groupBy: 'resident',
    }),
};

/* ------------------------------------------------------------------ *
 * Dashboard & reports
 * ------------------------------------------------------------------ */

export const dashboardApi = {
  get: (params: { month?: MonthKey; buildingId?: string; year?: number; stripLimit?: number }) =>
    apiGet<DashboardDto>('/dashboard', params),
};

export const reportsApi = {
  pnl: (params: { month?: MonthKey; buildingId?: string; year?: number }) =>
    apiGet<PnlResponseDto>('/reports/pnl', params),
};

/* ------------------------------------------------------------------ *
 * Staff & salaries
 * ------------------------------------------------------------------ */

export type StaffListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  buildingId?: string;
  month?: MonthKey;
  status?: 'all' | 'active' | 'inactive';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const staffApi = {
  list: (params: StaffListParams) =>
    apiGetPaged<StaffLedgerResponseDto['rows'][number], StaffLedgerTotalsMeta>('/staff', params),
  create: (input: CreateStaffInput) => apiPost<StaffDto>('/staff', input),
  update: (id: string, input: UpdateStaffInput) => apiPatch<StaffDto>(`/staff/${id}`, input),
  remove: (id: string) => apiDelete<{ id: string; archived: boolean }>(`/staff/${id}`),
};

export type StaffLedgerTotalsMeta = PaginationMeta & {
  month: MonthKey;
  totals: StaffLedgerResponseDto['totals'];
};

export type SalaryListParams = {
  page?: number;
  pageSize?: number;
  month?: MonthKey;
  buildingId?: string;
  staffId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const salariesApi = {
  list: (params: SalaryListParams) =>
    apiGetPaged<SalaryPaymentDto, PaginationMeta>('/salaries', params),
  create: (input: CreateSalaryPaymentInput) => apiPost<SalaryPaymentDto>('/salaries', input),
  update: (id: string, input: UpdateSalaryPaymentInput) =>
    apiPatch<SalaryPaymentDto>(`/salaries/${id}`, input),
  remove: (id: string) => apiDelete<{ id: string; reversed: boolean }>(`/salaries/${id}`),
  settle: (input: { staffId: string; salaryMonth: MonthKey; note?: string }) =>
    apiPost<SalaryPaymentDto>('/salaries/settle', input),
};

/* ------------------------------------------------------------------ *
 * Expenses
 * ------------------------------------------------------------------ */

export type ExpenseListParams = {
  page?: number;
  pageSize?: number;
  month?: MonthKey;
  buildingId?: string;
  categoryId?: string;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const expensesApi = {
  list: (params: ExpenseListParams) =>
    apiGetPaged<ExpenseDto, ExpenseListMeta>('/expenses', params),
  create: (input: CreateExpenseInput) => apiPost<ExpenseDto>('/expenses', input),
  update: (id: string, input: UpdateExpenseInput) => apiPatch<ExpenseDto>(`/expenses/${id}`, input),
  remove: (id: string) => apiDelete<{ id: string; removed: boolean }>(`/expenses/${id}`),
};

/* ------------------------------------------------------------------ *
 * Documents (private S3)
 * ------------------------------------------------------------------ */

export const documentsApi = {
  /** Multipart POST straight to the API; the file lands in GridFS. */
  upload: (
    residentId: string,
    kind: DocumentKind,
    file: File,
    onProgress?: (percent: number) => void,
  ) => uploadFile<ResidentDto>(`/residents/${residentId}/documents/${kind}`, file, onProgress),

  /**
   * The document's bytes as an object URL.
   * Fetched through the authenticated client rather than pointed at directly,
   * because an <img> tag cannot send the session token. Revoke the URL when the
   * component unmounts.
   */
  objectUrl: (residentId: string, kind: DocumentKind) =>
    fetchDocumentObjectUrl(`/residents/${residentId}/documents/${kind}`),

  remove: (residentId: string, kind: DocumentKind) =>
    apiDelete<void>(`/residents/${residentId}/documents/${kind}`),
};

/* ------------------------------------------------------------------ *
 * Exports & audit
 * ------------------------------------------------------------------ */

export const exportsApi = {
  residents: (params: { format?: 'csv' | 'json'; buildingId?: string } = {}) =>
    apiDownload('/export/residents', params),
  payments: (params: { format?: 'csv' | 'json'; month?: MonthKey; buildingId?: string } = {}) =>
    apiDownload('/export/payments', params),
  expenses: (params: { format?: 'csv' | 'json'; month?: MonthKey; buildingId?: string } = {}) =>
    apiDownload('/export/expenses', params),
};

export const auditApi = {
  list: (params: { page?: number; pageSize?: number; entityType?: string; entityId?: string }) =>
    apiGetPaged<AuditLogDto, PaginationMeta>('/audit-logs', params),
};

/* ------------------------------------------------------------------ *
 * Activity & diagnostics - the DEVELOPER role's visibility
 * ------------------------------------------------------------------ */

export type ActivityListParams = {
  page?: number;
  pageSize?: number;
  /** Free text across the actor, the record label and the summary. */
  search?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  /** Inclusive ISO dates: `2026-08-01`. */
  from?: string;
  to?: string;
  sortOrder?: 'asc' | 'desc';
};

/**
 * The audit trail rendered for people. `meta.filters` carries the entity types
 * and actors actually present in the log, so the filter selects are populated
 * from the data rather than from a hardcoded list.
 */
export const activityApi = {
  list: (params: ActivityListParams) =>
    apiGetPaged<ActivityEntryDto, ActivityListMeta>('/activity', params),
};

/** One snapshot of database, runtime, cache and timing health. */
export const diagnosticsApi = {
  get: () => apiGet<DiagnosticsDto>('/diagnostics'),
};

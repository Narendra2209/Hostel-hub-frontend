/**
 * Staff & salary data access.
 *
 * Every figure on the staff screen - the payroll, what has been paid, what is
 * still pending, each member's balance and status - is calculated by the API
 * and simply rendered here. These hooks only fetch, mutate and invalidate.
 */
import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  CreateSalaryPaymentInput,
  CreateStaffInput,
  MonthKey,
  PaginationMeta,
  SalaryPaymentDto,
  StaffDto,
  StaffLedgerRowDto,
  UpdateStaffInput,
} from '@hostel/shared';
import type { Paged } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import {
  salariesApi,
  staffApi,
  type SalaryListParams,
  type StaffListParams,
  type StaffLedgerTotalsMeta,
} from '../api/resources';
import { useInvalidate } from './useInvalidate';

/** The salary register for one month: rows plus the server's totals. */
export type StaffLedgerResult = Paged<StaffLedgerRowDto, StaffLedgerTotalsMeta>;

export type SalaryListResult = Paged<SalaryPaymentDto, PaginationMeta>;

export interface UpdateStaffVariables {
  id: string;
  input: UpdateStaffInput;
}

export interface SettleSalaryVariables {
  staffId: string;
  salaryMonth: MonthKey;
  note?: string;
}

export interface ArchiveStaffResult {
  id: string;
  archived: boolean;
}

export interface DeleteSalaryPaymentResult {
  id: string;
  reversed: boolean;
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

export function useStaffLedger(params: StaffListParams): UseQueryResult<StaffLedgerResult> {
  return useQuery({
    queryKey: queryKeys.staff.list(params),
    queryFn: () => staffApi.list(params),
  });
}

export function useSalaryList(
  params: SalaryListParams,
  options: { enabled?: boolean } = {},
): UseQueryResult<SalaryListResult> {
  return useQuery({
    queryKey: queryKeys.salaries.list(params),
    queryFn: () => salariesApi.list(params),
    enabled: options.enabled ?? true,
  });
}

/* ------------------------------------------------------------------ *
 * Mutations - each one refreshes every payroll-derived view
 * ------------------------------------------------------------------ */

export function useCreateStaff(): UseMutationResult<StaffDto, Error, CreateStaffInput> {
  const { payroll } = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => staffApi.create(input),
    onSuccess: payroll,
  });
}

export function useUpdateStaff(): UseMutationResult<StaffDto, Error, UpdateStaffVariables> {
  const { payroll } = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: UpdateStaffVariables) => staffApi.update(id, input),
    onSuccess: payroll,
  });
}

/**
 * Removing a staff member with salary history archives them instead of
 * deleting, so past months keep adding up. The server decides which happened
 * and says so in `archived`.
 */
export function useArchiveStaff(): UseMutationResult<ArchiveStaffResult, Error, string> {
  const { payroll } = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: payroll,
  });
}

export function useCreateSalaryPayment(): UseMutationResult<
  SalaryPaymentDto,
  Error,
  CreateSalaryPaymentInput
> {
  const { payroll } = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateSalaryPaymentInput) => salariesApi.create(input),
    onSuccess: payroll,
  });
}

/** "Full" - the server works out the outstanding amount and pays it off. */
export function useSettleSalary(): UseMutationResult<
  SalaryPaymentDto,
  Error,
  SettleSalaryVariables
> {
  const { payroll } = useInvalidate();
  return useMutation({
    mutationFn: (input: SettleSalaryVariables) => salariesApi.settle(input),
    onSuccess: payroll,
  });
}

export function useDeleteSalaryPayment(): UseMutationResult<
  DeleteSalaryPaymentResult,
  Error,
  string
> {
  const { payroll } = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => salariesApi.remove(id),
    onSuccess: payroll,
  });
}

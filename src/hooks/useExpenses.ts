/**
 * Bills & expenses data access.
 *
 * The list endpoint returns the rows *and* the month's authoritative totals
 * (`meta.totals`), so no screen ever adds up an array the API has already
 * totalled. Every mutation invalidates through `useInvalidate().expenses()`,
 * which also refreshes the dashboard and the P&L - a bill logged here changes
 * the numbers on both of those screens.
 */
import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  CreateExpenseInput,
  ExpenseDto,
  ExpenseListMeta,
  UpdateExpenseInput,
} from '@hostel/shared';
import type { Paged } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { expensesApi, type ExpenseListParams } from '../api/resources';
import { useInvalidate } from './useInvalidate';

/** Rows plus the pagination and totals meta the server sent with them. */
export type ExpenseListResult = Paged<ExpenseDto, ExpenseListMeta>;

export function useExpenseList(params: ExpenseListParams): UseQueryResult<ExpenseListResult> {
  return useQuery({
    queryKey: queryKeys.expenses.list(params),
    queryFn: () => expensesApi.list(params),
  });
}

export function useCreateExpense(): UseMutationResult<ExpenseDto, Error, CreateExpenseInput> {
  const { expenses } = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => expensesApi.create(input),
    onSuccess: () => {
      expenses();
    },
  });
}

export interface UpdateExpenseVariables {
  id: string;
  input: UpdateExpenseInput;
}

export function useUpdateExpense(): UseMutationResult<ExpenseDto, Error, UpdateExpenseVariables> {
  const { expenses } = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: UpdateExpenseVariables) => expensesApi.update(id, input),
    onSuccess: () => {
      expenses();
    },
  });
}

export function useDeleteExpense(): UseMutationResult<{ id: string; removed: boolean }, Error, string> {
  const { expenses } = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      expenses();
    },
  });
}

/**
 * Fee ledger and fee-payment data access.
 *
 * Every figure on the fee screen - expected, paid, balance, status, dueDate,
 * daysOverdue and the three totals - is derived by the backend's fee engine and
 * simply rendered here. In particular `useSettlePayment` deliberately sends no
 * amount: the server works out the outstanding balance inside the transaction
 * that writes it, so a stale screen can never over- or under-pay a month.
 */
import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreatePaymentInput,
  FeeLedgerResponseDto,
  FeePaymentDto,
  MonthKey,
  PaginationMeta,
  UpdatePaymentInput,
} from '@hostel/shared';
import type { Paged } from '../api/client';
import {
  feesApi,
  paymentsApi,
  type FeeLedgerParams,
  type PaymentListParams,
} from '../api/resources';
import { queryKeys } from '../api/queryKeys';
import { useInvalidate } from './useInvalidate';

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** One month of the ledger: a row per enrolled resident, plus the totals. */
export function useFeeLedger(params: FeeLedgerParams): UseQueryResult<FeeLedgerResponseDto> {
  return useQuery({
    queryKey: queryKeys.fees.ledger(params),
    queryFn: () => feesApi.ledger(params),
  });
}

/** The payments actually received, newest first, as the server paged them. */
export function usePaymentList(
  params: PaymentListParams,
): UseQueryResult<Paged<FeePaymentDto, PaginationMeta>> {
  return useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: () => paymentsApi.list(params),
  });
}

/* ------------------------------------------------------------------ *
 * Writes
 *
 * Each one refreshes every view derived from the ledger - the dashboard, the
 * overdue list, the resident profiles and the P&L - through invalidate.financial().
 * ------------------------------------------------------------------ */

/** Record money in against one resident and one billing month. */
export function useCreatePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => paymentsApi.create(input),
    onSuccess: () => {
      invalidate.financial();
    },
  });
}

export interface SettlePaymentArgs {
  residentId: string;
  billingMonth: MonthKey;
  note?: string;
}

/** "Full" / "Mark paid". The amount is the server's to decide, never ours. */
export function useSettlePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: SettlePaymentArgs) => paymentsApi.settle(input),
    onSuccess: () => {
      invalidate.financial();
    },
  });
}

/** The reference UI's "Undo" - the row is reversed and audited server-side. */
export function useDeletePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => {
      invalidate.financial();
    },
  });
}

export interface UpdatePaymentArgs {
  id: string;
  input: UpdatePaymentInput;
}

/** Correct an already-recorded payment. */
export function useUpdatePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: UpdatePaymentArgs) => paymentsApi.update(id, input),
    onSuccess: () => {
      invalidate.financial();
    },
  });
}

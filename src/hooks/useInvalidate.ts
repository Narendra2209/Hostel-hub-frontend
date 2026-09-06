/**
 * Cache invalidation after a mutation.
 *
 * Financial data is deeply interconnected: recording one payment changes the
 * fee ledger, the dashboard totals, the overdue list, that resident's profile
 * and the P&L. Rather than have each screen remember which of those to refresh,
 * mutations call one of these helpers and every derived view refetches.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EXPENSE_KEYS, FINANCIAL_KEYS, PAYROLL_KEYS, queryKeys } from '../api/queryKeys';

export function useInvalidate() {
  const queryClient = useQueryClient();

  const invalidateMany = useCallback(
    (keys: readonly (readonly string[])[]) => {
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient],
  );

  return {
    /** A fee payment, resident or building changed. */
    financial: useCallback(() => invalidateMany(FINANCIAL_KEYS), [invalidateMany]),
    /** Staff or a salary payment changed. */
    payroll: useCallback(() => invalidateMany(PAYROLL_KEYS), [invalidateMany]),
    /** An expense or category changed. */
    expenses: useCallback(() => invalidateMany(EXPENSE_KEYS), [invalidateMany]),
    /** Buildings changed - they appear in every filter and summary. */
    buildings: useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.buildings.all });
      invalidateMany(FINANCIAL_KEYS);
      invalidateMany(EXPENSE_KEYS);
      invalidateMany(PAYROLL_KEYS);
    }, [queryClient, invalidateMany]),
    /** One resident's own views. */
    resident: useCallback(
      (residentId: string) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
        void queryClient.invalidateQueries({ queryKey: ['residents', 'profile', residentId] });
        void queryClient.invalidateQueries({ queryKey: ['residents', 'payments', residentId] });
        void queryClient.invalidateQueries({ queryKey: ['residents', 'fee-status', residentId] });
      },
      [queryClient],
    ),
    raw: queryClient,
  };
}

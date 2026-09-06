/**
 * Hostel settings, buildings and expense categories.
 *
 * These change rarely and are needed on nearly every screen, so they are cached
 * for a long stale time. They still come from PostgreSQL - nothing here is
 * hardcoded.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BuildingDto,
  ExpenseCategoryDto,
  SettingsDto,
  UpdateSettingsInput,
} from '@hostel/shared';
import { DEFAULT_CURRENCY_SYMBOL, formatMoney, formatSignedMoney } from '@hostel/shared';
import { buildingsApi, categoriesApi, settingsApi } from '../api/resources';
import { queryKeys } from '../api/queryKeys';

const LONG_STALE = 5 * 60 * 1000;

export function useSettings() {
  return useQuery<SettingsDto>({
    queryKey: queryKeys.settings,
    queryFn: settingsApi.get,
    staleTime: LONG_STALE,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => settingsApi.update(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings, updated);
      // The due day and timezone feed every financial calculation.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.fees.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overdue.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

export function useBuildings() {
  return useQuery<BuildingDto[]>({
    queryKey: queryKeys.buildings.list(),
    queryFn: buildingsApi.list,
    staleTime: LONG_STALE,
  });
}

export function useExpenseCategories() {
  return useQuery<ExpenseCategoryDto[]>({
    queryKey: queryKeys.categories.list(),
    queryFn: categoriesApi.list,
    staleTime: LONG_STALE,
  });
}

/**
 * Currency-aware formatters bound to the hostel's configured symbol.
 * Falls back to the rupee sign while settings are still loading, so a figure is
 * never rendered with a stray placeholder.
 */
export function useMoney() {
  const { data: settings } = useSettings();
  const symbol = settings?.currency ?? DEFAULT_CURRENCY_SYMBOL;

  const money = useCallback((value: unknown) => formatMoney(value, symbol), [symbol]);
  const signedMoney = useCallback((value: unknown) => formatSignedMoney(value, symbol), [symbol]);

  return { money, signedMoney, symbol, settings };
}

/** Resolve a building id to its name, for headings and chips. */
export function useBuildingName(buildingId: string): string {
  const { data: buildings } = useBuildings();
  if (buildingId === 'all') return 'All buildings';
  if (buildingId === 'shared') return 'Shared';
  return buildings?.find((b) => b.id === buildingId)?.name ?? 'Building';
}

/**
 * Mutations for the two pieces of configuration the Settings screen owns:
 * buildings and expense categories.
 *
 * Both are referenced by nearly every other screen - a building name appears in
 * filters, chips and summaries; a category name appears on every bill - so each
 * mutation invalidates through `useInvalidate().buildings()`, which refreshes
 * the buildings cache along with the financial, expense and payroll views.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { BuildingDto, CreateBuildingInput, ExpenseCategoryDto, UpdateBuildingInput } from '@hostel/shared';
import { buildingsApi, categoriesApi } from '../api/resources';
import { queryKeys } from '../api/queryKeys';
import { useInvalidate } from './useInvalidate';
import { ApiClientError } from '../api/client';

export interface UpdateBuildingVariables {
  id: string;
  input: UpdateBuildingInput;
}

export interface CreateCategoryVariables {
  name: string;
  sortOrder?: number;
}

export interface UpdateCategoryVariables {
  id: string;
  input: { name?: string; active?: boolean; sortOrder?: number };
}

export function useCreateBuilding(): UseMutationResult<
  BuildingDto,
  ApiClientError,
  CreateBuildingInput
> {
  const invalidate = useInvalidate();
  return useMutation<BuildingDto, ApiClientError, CreateBuildingInput>({
    mutationFn: (input) => buildingsApi.create(input),
    onSuccess: () => invalidate.buildings(),
  });
}

export function useUpdateBuilding(): UseMutationResult<
  BuildingDto,
  ApiClientError,
  UpdateBuildingVariables
> {
  const invalidate = useInvalidate();
  return useMutation<BuildingDto, ApiClientError, UpdateBuildingVariables>({
    mutationFn: ({ id, input }) => buildingsApi.update(id, input),
    onSuccess: () => invalidate.buildings(),
  });
}

export function useDeleteBuilding(): UseMutationResult<{ id: string }, ApiClientError, string> {
  const invalidate = useInvalidate();
  return useMutation<{ id: string }, ApiClientError, string>({
    mutationFn: (id) => buildingsApi.remove(id),
    onSuccess: () => invalidate.buildings(),
  });
}

/**
 * Categories live beside buildings in the same configuration cache group, but
 * they have their own key prefix, so they are invalidated explicitly as well.
 */
function useCategoryInvalidation(): () => void {
  const invalidate = useInvalidate();
  return () => {
    void invalidate.raw.invalidateQueries({ queryKey: queryKeys.categories.all });
    invalidate.buildings();
  };
}

export function useCreateCategory(): UseMutationResult<
  ExpenseCategoryDto,
  ApiClientError,
  CreateCategoryVariables
> {
  const invalidateCategories = useCategoryInvalidation();
  return useMutation<ExpenseCategoryDto, ApiClientError, CreateCategoryVariables>({
    mutationFn: (input) => categoriesApi.create(input),
    onSuccess: invalidateCategories,
  });
}

export function useUpdateCategory(): UseMutationResult<
  ExpenseCategoryDto,
  ApiClientError,
  UpdateCategoryVariables
> {
  const invalidateCategories = useCategoryInvalidation();
  return useMutation<ExpenseCategoryDto, ApiClientError, UpdateCategoryVariables>({
    mutationFn: ({ id, input }) => categoriesApi.update(id, input),
    onSuccess: invalidateCategories,
  });
}

export function useDeleteCategory(): UseMutationResult<{ id: string }, ApiClientError, string> {
  const invalidateCategories = useCategoryInvalidation();
  return useMutation<{ id: string }, ApiClientError, string>({
    mutationFn: (id) => categoriesApi.remove(id),
    onSuccess: invalidateCategories,
  });
}

/**
 * "Log a bill" - the expense form from the reference UI, in create and edit
 * modes.
 *
 * Validation is the shared `createExpenseSchema`, the very same schema the API
 * validates the request with, so the browser and the server can never disagree
 * about what a valid bill looks like. The blank building option means "shared,
 * not attributed to one building" and is sent as `undefined`, never as an
 * empty string.
 */
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createExpenseSchema, todayIso } from '@hostel/shared';
import type { CreateExpenseInput, ExpenseDto } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { FormError, FormField } from '../common/FormField';
import { QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { useToast } from '../common/ToastProvider';
import { useCreateExpense, useUpdateExpense } from '../../hooks/useExpenses';
import { useBuildings, useExpenseCategories, useSettings } from '../../hooks/useSettings';

/**
 * The raw shape of the form controls. Amounts arrive from the DOM as strings
 * and `buildingId` is absent for a shared cost; `createExpenseSchema` coerces
 * and narrows both.
 */
interface ExpenseFormValues {
  date: string;
  buildingId?: string;
  categoryId: string;
  amount: string;
  vendor: string;
  note: string;
}

export interface ExpenseFormProps {
  /** The bill being edited, or null to log a new one. */
  expense: ExpenseDto | null;
  /** Leave edit mode (clears `?edit=` on the page). */
  onDone: () => void;
}

export function ExpenseForm({ expense, onDone }: ExpenseFormProps): JSX.Element {
  const settingsQuery = useSettings();
  const buildingsQuery = useBuildings();
  const categoriesQuery = useExpenseCategories();
  const toast = useToast();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const buildings = buildingsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const editing = expense !== null;

  // "Today" is the hostel's today, not the browser's.
  const today = todayIso(settingsQuery.data?.timezone);
  const firstCategoryId = categories[0]?.id ?? '';

  const defaults = useMemo<ExpenseFormValues>(
    () => ({
      date: expense?.date ?? today,
      buildingId: expense?.buildingId ?? undefined,
      categoryId: expense?.categoryId ?? firstCategoryId,
      amount: expense ? String(expense.amount) : '',
      vendor: expense?.vendor ?? '',
      note: expense?.note ?? '',
    }),
    [expense, today, firstCategoryId],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: defaults,
  });

  // Re-seed when the edited bill changes, and once the categories and the
  // hostel timezone have arrived - both of which happen behind the skeleton
  // below, so a half-typed bill is never wiped.
  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const saving = createExpense.isPending || updateExpense.isPending;
  const failure = updateExpense.error ?? createExpense.error;

  const onSubmit = handleSubmit(async (values) => {
    // Already validated by the resolver; parsing again is what turns the form's
    // strings into the typed payload the API expects.
    const input: CreateExpenseInput = createExpenseSchema.parse(values);
    try {
      if (expense) {
        await updateExpense.mutateAsync({ id: expense.id, input });
        toast.success('Bill updated.');
        onDone();
      } else {
        await createExpense.mutateAsync(input);
        toast.success('Bill logged.');
        reset(defaults);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Card
      title={editing ? 'Edit bill' : 'Log a bill'}
      actions={
        editing ? (
          <Button variant="ghost" size="sm" onClick={onDone} disabled={saving}>
            Cancel
          </Button>
        ) : undefined
      }
    >
      <QueryBoundary
        isLoading={buildingsQuery.isLoading || categoriesQuery.isLoading}
        error={buildingsQuery.error ?? categoriesQuery.error}
        onRetry={() => {
          void buildingsQuery.refetch();
          void categoriesQuery.refetch();
        }}
        errorTitle="Could not load the bill form"
        skeleton={<TableSkeleton rows={2} columns={6} />}
      >
        <form className="formgrid" onSubmit={onSubmit} noValidate>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormError message={failure ? errorMessage(failure) : null} />
          </div>

          <FormField label="Date" error={errors.date?.message}>
            {(field) => <input {...field} type="date" {...register('date')} />}
          </FormField>

          <FormField label="Building" error={errors.buildingId?.message}>
            {(field) => (
              <Controller
                name="buildingId"
                control={control}
                render={({ field: building }) => (
                  <select
                    {...field}
                    name={building.name}
                    ref={building.ref}
                    value={building.value ?? ''}
                    onBlur={building.onBlur}
                    onChange={(event) =>
                      building.onChange(event.target.value === '' ? undefined : event.target.value)
                    }
                  >
                    <option value="">Shared / all</option>
                    {buildings.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            )}
          </FormField>

          <FormField label="Category" error={errors.categoryId?.message}>
            {(field) => (
              <select {...field} {...register('categoryId')}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Amount" error={errors.amount?.message}>
            {(field) => (
              <input
                {...field}
                className="num"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                {...register('amount')}
              />
            )}
          </FormField>

          <FormField label="Vendor" error={errors.vendor?.message}>
            {(field) => <input {...field} type="text" {...register('vendor')} />}
          </FormField>

          <FormField label="Note" error={errors.note?.message}>
            {(field) => (
              <input
                {...field}
                type="text"
                placeholder="Meter reading, vendor, period…"
                {...register('note')}
              />
            )}
          </FormField>

          <div className="actions">
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add bill'}
            </Button>
          </div>
        </form>
      </QueryBoundary>
    </Card>
  );
}

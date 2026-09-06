/**
 * "Hostel details" - the four settings every other screen reads: the name on
 * the rail, the currency symbol every figure is formatted with, the default due
 * day the fee engine bills against, and the timezone "today" is evaluated in.
 *
 * Beneath it sits the expense-category list, so the categories bills are filed
 * under stay configurable instead of hardcoded.
 */
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ExpenseCategoryDto, SettingsDto, UpdateSettingsInput } from '@hostel/shared';
import { updateSettingsSchema } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { FormError, FormField } from '../common/FormField';
import { useConfirm } from '../common/ConfirmProvider';
import { useToast } from '../common/ToastProvider';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { useExpenseCategories, useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { useCreateCategory, useUpdateCategory } from '../../hooks/useBuildingMutations';
import { usePermissions } from '../../auth/AuthProvider';
import { entries } from '../../utils/format';

/**
 * Configuration, not business data: a short list of IANA zones a hostel is
 * plausibly run from, with the one this application was built for first.
 */
const TIMEZONE_OPTIONS: readonly string[] = [
  'Asia/Kolkata',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
];

export function HostelDetailsCard(): JSX.Element {
  const { canAdminister } = usePermissions();
  const settingsQuery = useSettings();

  return (
    <>
      <Card
        title="Hostel details"
        hint={canAdminister ? undefined : 'Read only - ask an owner to change these'}
      >
        <QueryBoundary
          isLoading={settingsQuery.isLoading}
          error={settingsQuery.error}
          onRetry={() => void settingsQuery.refetch()}
          errorTitle="Could not load the hostel details"
          skeleton={<TableSkeleton rows={3} columns={2} />}
        >
          {settingsQuery.data ? (
            <DetailsForm settings={settingsQuery.data} canAdminister={canAdminister} />
          ) : null}
        </QueryBoundary>
      </Card>

      <ExpenseCategoriesCard />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The form itself - mounted only once real settings have arrived, so the
 * fields never start life holding a placeholder.
 * ------------------------------------------------------------------ */

function DetailsForm({
  settings,
  canAdminister,
}: {
  settings: SettingsDto;
  canAdminister: boolean;
}): JSX.Element {
  const toast = useToast();
  const updateSettings = useUpdateSettings();

  const timezones = useMemo(
    () =>
      TIMEZONE_OPTIONS.includes(settings.timezone)
        ? TIMEZONE_OPTIONS
        : [settings.timezone, ...TIMEZONE_OPTIONS],
    [settings.timezone],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    values: {
      hostelName: settings.hostelName,
      currency: settings.currency,
      defaultDueDay: settings.defaultDueDay,
      timezone: settings.timezone,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await updateSettings.mutateAsync(values);
      reset({
        hostelName: saved.hostelName,
        currency: saved.currency,
        defaultDueDay: saved.defaultDueDay,
        timezone: saved.timezone,
      });
      toast.success('Hostel details saved');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <FormError message={updateSettings.error ? errorMessage(updateSettings.error) : null} />
      <div className="formgrid">
        <FormField label="Hostel name" error={errors.hostelName?.message}>
          {(props) => (
            <input {...props} type="text" readOnly={!canAdminister} {...register('hostelName')} />
          )}
        </FormField>

        <FormField label="Currency symbol" error={errors.currency?.message}>
          {(props) => (
            <input {...props} type="text" readOnly={!canAdminister} {...register('currency')} />
          )}
        </FormField>

        <FormField
          label="Default due day"
          error={errors.defaultDueDay?.message}
          hint="Changing this moves the due date on every unpaid month, so it changes which fees count as overdue."
        >
          {(props) => (
            <input
              {...props}
              type="number"
              className="num"
              min={1}
              max={31}
              readOnly={!canAdminister}
              {...register('defaultDueDay', { valueAsNumber: true })}
            />
          )}
        </FormField>

        <FormField
          label="Timezone"
          error={errors.timezone?.message}
          hint="Every date the fee engine calls today is worked out in this zone."
        >
          {(props) => (
            <select {...props} disabled={!canAdminister} {...register('timezone')}>
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          )}
        </FormField>

        {canAdminister ? (
          <div className="actions">
            <Button type="submit" loading={updateSettings.isPending}>
              Save details
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Expense categories
 * ------------------------------------------------------------------ */

function ExpenseCategoriesCard(): JSX.Element {
  const { canManageRecords } = usePermissions();
  const categoriesQuery = useExpenseCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const confirm = useConfirm();
  const toast = useToast();

  const [newName, setNewName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const categories = categoriesQuery.data ?? [];

  const onAdd = async (): Promise<void> => {
    const name = newName.trim();
    if (name.length === 0) {
      toast.error('Enter a category name.');
      return;
    }
    try {
      await createCategory.mutateAsync({ name });
      setNewName('');
      toast.success(`${name} added`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onSetActive = async (category: ExpenseCategoryDto, active: boolean): Promise<void> => {
    if (!active) {
      const confirmed = await confirm({
        title: `Deactivate ${category.name}?`,
        message: 'It stops appearing when someone logs a bill. You can restore it here later.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    setBusyId(category.id);
    try {
      await updateCategory.mutateAsync({ id: category.id, input: { active } });
      toast.success(`${category.name} ${active ? 'restored' : 'deactivated'}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Expense categories" hint="What every bill can be filed under">
      <QueryBoundary
        isLoading={categoriesQuery.isLoading}
        error={categoriesQuery.error}
        onRetry={() => void categoriesQuery.refetch()}
        isEmpty={categories.length === 0}
        errorTitle="Could not load the categories"
        skeleton={<TableSkeleton rows={4} columns={3} />}
        empty={
          <EmptyState
            title="No categories yet"
            message="Add electricity, water or mess so bills can be grouped."
          />
        }
      >
        {categories.map((category) => (
          <div className="bldline" key={category.id}>
            <span style={{ flex: 1 }}>
              {category.name}
              {category.active ? null : (
                <span className="chip off" style={{ marginLeft: 8 }}>
                  Inactive
                </span>
              )}
            </span>
            <span className="hint num">{entries(category.expenseCount)}</span>
            {canManageRecords ? (
              category.active ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={category.expenseCount > 0 || busyId !== null}
                  loading={busyId === category.id}
                  title={
                    category.expenseCount > 0
                      ? `${entries(category.expenseCount)} are filed under this category, so it stays available.`
                      : undefined
                  }
                  onClick={() => void onSetActive(category, false)}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId !== null}
                  loading={busyId === category.id}
                  onClick={() => void onSetActive(category, true)}
                >
                  Restore
                </Button>
              )
            ) : null}
          </div>
        ))}
      </QueryBoundary>

      {canManageRecords ? (
        <div className="imgacts">
          <input
            type="text"
            value={newName}
            aria-label="New category name"
            placeholder="Laundry"
            style={{ flex: 1, minWidth: 160 }}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Button onClick={() => void onAdd()} loading={createCategory.isPending}>
            Add category
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

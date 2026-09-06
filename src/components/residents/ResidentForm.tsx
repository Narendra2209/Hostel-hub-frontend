/**
 * Add / edit a resident.
 *
 * The same card does both jobs, exactly as the reference UI did: the header
 * reads "Add a resident" or "Edit {name}", and editing is driven by the
 * `?edit=<id>` search param so a half-finished edit survives a refresh.
 *
 * Validation uses the shared Zod schemas, so the browser and the API agree on
 * what a valid resident is. The resolver runs in `raw` mode: the form keeps the
 * values the user actually typed and the request body is built explicitly
 * below, which keeps the payload honestly typed instead of relying on whatever
 * Zod happened to transform.
 */
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateResidentInput, UpdateResidentInput } from '@hostel/shared';
import {
  createResidentSchema,
  currentMonthKey,
  updateResidentSchema,
} from '@hostel/shared';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { FormError, FormField } from '../common/FormField';
import { errorMessage } from '../common/states';
import { ApiClientError } from '../../api/client';
import { useToast } from '../common/ToastProvider';
import { useBuildings, useSettings } from '../../hooks/useSettings';
import { useCreateResident, useResident, useUpdateResident } from '../../hooks/useResidents';

interface ResidentFormValues {
  name: string;
  buildingId: string;
  phone: string;
  monthlyFee: number | undefined;
  dueDay: number | undefined;
  joinMonth: string;
  vacatedMonth: string | null;
}

const FIELD_NAMES = [
  'name',
  'buildingId',
  'phone',
  'monthlyFee',
  'dueDay',
  'joinMonth',
  'vacatedMonth',
] as const;

type ResidentFieldName = (typeof FIELD_NAMES)[number];

const isFieldName = (value: string): value is ResidentFieldName =>
  (FIELD_NAMES as readonly string[]).includes(value);

/** Blank in a number input means "not answered", never zero. */
const numberOrUndefined = (value: unknown): number | undefined =>
  value === '' || value === null || value === undefined ? undefined : Number(value);

const monthOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export interface ResidentFormProps {
  /** The resident being edited, from `?edit=<id>`; null means "add". */
  editingId: string | null;
  /** Leave edit mode - clears the search param on the page. */
  onDone: () => void;
}

export function ResidentForm({ editingId, onDone }: ResidentFormProps): JSX.Element {
  const toast = useToast();
  const { data: buildings, isLoading: buildingsLoading } = useBuildings();
  const { data: settings } = useSettings();
  const editing = useResident(editingId);
  const create = useCreateResident();
  const update = useUpdateResident();

  const blankValues = useMemo<ResidentFormValues>(
    () => ({
      name: '',
      buildingId: buildings?.[0]?.id ?? '',
      phone: '',
      monthlyFee: undefined,
      dueDay: settings?.defaultDueDay,
      joinMonth: currentMonthKey(),
      vacatedMonth: null,
    }),
    [buildings, settings],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ResidentFormValues>({
    defaultValues: blankValues,
    resolver: zodResolver(editingId ? updateResidentSchema : createResidentSchema, undefined, {
      raw: true,
    }),
  });

  const editingResident = editingId ? editing.data : undefined;

  // Load the resident being edited into the form, and empty it again when the
  // edit is finished or cancelled.
  useEffect(() => {
    if (editingResident) {
      reset({
        name: editingResident.name,
        buildingId: editingResident.buildingId,
        phone: editingResident.phone ?? '',
        monthlyFee: editingResident.monthlyFee,
        dueDay: editingResident.dueDay,
        joinMonth: editingResident.joinMonth,
        vacatedMonth: editingResident.vacatedMonth,
      });
      return;
    }
    // Only blank a form nobody has typed into: settings and buildings can
    // arrive after the first render and must not wipe what is being written.
    if (!editingId && !isDirty) reset(blankValues);
  }, [editingResident, editingId, isDirty, reset, blankValues]);

  const applyServerErrors = (error: unknown): void => {
    if (!(error instanceof ApiClientError) || !error.details) return;
    for (const [field, messages] of Object.entries(error.details)) {
      const message = messages[0];
      if (message && isFieldName(field)) setError(field, { type: 'server', message });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const phone = values.phone.trim();
    const shared = {
      name: values.name.trim(),
      buildingId: values.buildingId,
      phone: phone.length > 0 ? phone : undefined,
      joinMonth: values.joinMonth,
      vacatedMonth: values.vacatedMonth,
    };

    try {
      if (editingId) {
        const input: UpdateResidentInput = {
          ...shared,
          monthlyFee: values.monthlyFee,
          dueDay: values.dueDay,
        };
        const updated = await update.mutateAsync({ id: editingId, input });
        toast.success(`Saved ${updated.name}.`);
        onDone();
        return;
      }

      // The create schema requires both figures, so the resolver has already
      // refused an empty one by the time we get here.
      if (values.monthlyFee === undefined || values.dueDay === undefined) return;

      const input: CreateResidentInput = {
        ...shared,
        monthlyFee: values.monthlyFee,
        dueDay: values.dueDay,
      };
      const created = await create.mutateAsync(input);
      toast.success(`${created.name} was added.`);
      reset(blankValues);
    } catch (error) {
      applyServerErrors(error);
      toast.error(errorMessage(error));
    }
  });

  const saving = create.isPending || update.isPending;
  const loadingEdit = Boolean(editingId) && editing.isLoading;
  const title = editingId
    ? `Edit ${editingResident?.name ?? 'resident'}`
    : 'Add a resident';

  return (
    <Card
      title={title}
      actions={
        editingId ? (
          <Button variant="ghost" size="sm" onClick={onDone} disabled={saving}>
            Cancel
          </Button>
        ) : undefined
      }
    >
      <FormError message={editingId && editing.error ? errorMessage(editing.error) : null} />

      <form className="formgrid" onSubmit={onSubmit} noValidate>
        <FormField label="Name" error={errors.name?.message}>
          {(props) => <input {...props} type="text" autoComplete="off" {...register('name')} />}
        </FormField>

        <FormField label="Building" error={errors.buildingId?.message}>
          {(props) => (
            <select {...props} disabled={buildingsLoading} {...register('buildingId')}>
              {(buildings ?? []).map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Phone" error={errors.phone?.message}>
          {(props) => <input {...props} type="tel" autoComplete="off" {...register('phone')} />}
        </FormField>

        <FormField label="Monthly rent" error={errors.monthlyFee?.message}>
          {(props) => (
            <input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="num"
              {...register('monthlyFee', { setValueAs: numberOrUndefined })}
            />
          )}
        </FormField>

        <FormField label="Due day" error={errors.dueDay?.message}>
          {(props) => (
            <input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              step={1}
              className="num"
              {...register('dueDay', { setValueAs: numberOrUndefined })}
            />
          )}
        </FormField>

        <FormField label="Joined" error={errors.joinMonth?.message}>
          {(props) => <input {...props} type="month" {...register('joinMonth')} />}
        </FormField>

        <FormField label="Vacated (blank if staying)" error={errors.vacatedMonth?.message}>
          {(props) => (
            <input {...props} type="month" {...register('vacatedMonth', { setValueAs: monthOrNull })} />
          )}
        </FormField>

        <div className="actions">
          <Button type="submit" loading={saving} disabled={loadingEdit}>
            {editingId ? 'Save changes' : 'Add resident'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

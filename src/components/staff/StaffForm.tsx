/**
 * Add or edit a member of staff.
 *
 * The reference form: Name, Role, Works at, Monthly salary, Status. Validation
 * uses the same Zod schemas the API validates with, so a rejected value reads
 * the same on both sides of the wire.
 */
import { useEffect, useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createStaffSchema,
  updateStaffSchema,
  type CreateStaffInput,
  type StaffLedgerRowDto,
} from '@hostel/shared';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { FormError, FormField } from '../common/FormField';
import { errorMessage } from '../common/states';
import { useToast } from '../common/ToastProvider';
import { useBuildings } from '../../hooks/useSettings';
import { useCreateStaff, useUpdateStaff } from '../../hooks/useStaff';

const EMPTY_STAFF: DefaultValues<CreateStaffInput> = {
  name: '',
  role: '',
  buildingId: null,
  monthlySalary: undefined,
  active: true,
};

export interface StaffFormProps {
  /** The row being edited, or null while adding. Driven by `?edit=<id>`. */
  editing: StaffLedgerRowDto | null;
  /** Called after a successful save, and by Cancel, to clear `?edit`. */
  onDone: () => void;
}

export function StaffForm({ editing, onDone }: StaffFormProps): JSX.Element {
  const { data: buildings, isLoading: buildingsLoading } = useBuildings();
  const toast = useToast();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateStaffInput>({
    resolver: zodResolver(editing ? updateStaffSchema : createStaffSchema),
    defaultValues: EMPTY_STAFF,
  });

  useEffect(() => {
    setSubmitError(null);
    reset(
      editing
        ? {
            name: editing.name,
            role: editing.role ?? '',
            buildingId: editing.buildingId,
            monthlySalary: editing.monthlySalary,
            active: editing.active,
          }
        : EMPTY_STAFF,
    );
  }, [editing, reset]);

  const buildingValue = watch('buildingId');
  const activeValue = watch('active');
  const submitting = createStaff.isPending || updateStaff.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (editing) {
        await updateStaff.mutateAsync({ id: editing.id, input: values });
        toast.success(`${editing.name} updated`);
      } else {
        await createStaff.mutateAsync(values);
        toast.success(`${values.name} added to the register`);
      }
      reset(EMPTY_STAFF);
      onDone();
    } catch (error) {
      setSubmitError(errorMessage(error));
      toast.error(errorMessage(error));
    }
  });

  return (
    <Card
      title={editing ? `Edit ${editing.name}` : 'Add staff'}
      actions={
        editing ? (
          <Button variant="ghost" size="sm" onClick={onDone} disabled={submitting}>
            Cancel
          </Button>
        ) : undefined
      }
    >
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        noValidate
      >
        <FormError message={submitError} />
        <div className="formgrid">
          <FormField label="Name" error={errors.name?.message}>
            {(props) => <input {...props} type="text" autoComplete="off" {...register('name')} />}
          </FormField>

          <FormField label="Role" error={errors.role?.message}>
            {(props) => <input {...props} type="text" autoComplete="off" {...register('role')} />}
          </FormField>

          <FormField label="Works at" error={errors.buildingId?.message}>
            {(props) => (
              <select
                {...props}
                value={buildingValue ?? ''}
                disabled={buildingsLoading}
                onChange={(event) =>
                  setValue(
                    'buildingId',
                    event.target.value === '' ? null : event.target.value,
                    { shouldDirty: true },
                  )
                }
              >
                <option value="">All buildings</option>
                {(buildings ?? []).map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Monthly salary" error={errors.monthlySalary?.message}>
            {(props) => (
              <input
                {...props}
                className="num"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                {...register('monthlySalary', { valueAsNumber: true })}
              />
            )}
          </FormField>

          <FormField label="Status" error={errors.active?.message}>
            {(props) => (
              <select
                {...props}
                value={activeValue === false ? 'false' : 'true'}
                onChange={(event) =>
                  setValue('active', event.target.value === 'true', { shouldDirty: true })
                }
              >
                <option value="true">Working</option>
                <option value="false">Left</option>
              </select>
            )}
          </FormField>

          <div className="actions">
            <Button type="submit" loading={submitting}>
              {editing ? 'Save changes' : 'Add staff'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

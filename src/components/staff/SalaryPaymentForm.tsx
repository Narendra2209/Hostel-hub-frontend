/**
 * Record a salary payment in full detail - month, amount, date, method, note.
 *
 * The inline "Add" and "Full" buttons on the register cover the everyday case;
 * this dialog is for the payment that needs a date, a method or a reference,
 * and it lists what has already been recorded for that month so a mistaken
 * entry can be taken back out.
 */
import { useEffect, useId, useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  createSalaryPaymentSchema,
  formatDateLabel,
  formatMonthLabel,
  isMonthKey,
  todayIso,
  type CreateSalaryPaymentInput,
  type MonthKey,
  type StaffLedgerRowDto,
} from '@hostel/shared';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { FormError, FormField } from '../common/FormField';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { useConfirm } from '../common/ConfirmProvider';
import { useToast } from '../common/ToastProvider';
import { usePermissions } from '../../auth/AuthProvider';
import { useMoney, useSettings } from '../../hooks/useSettings';
import { useCreateSalaryPayment, useDeleteSalaryPayment, useSalaryList } from '../../hooks/useStaff';
import { orDash } from '../../utils/format';

export interface SalaryPaymentFormProps {
  /** The month the register is showing - the dialog's starting month. */
  month: MonthKey;
  /** Staff to choose from: the rows already loaded for this month. */
  staff: StaffLedgerRowDto[];
  onClose: () => void;
}

export function SalaryPaymentForm({
  month,
  staff,
  onClose,
}: SalaryPaymentFormProps): JSX.Element {
  const formId = useId();
  const { money } = useMoney();
  const { data: settings } = useSettings();
  const { canManageRecords } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();

  const createPayment = useCreateSalaryPayment();
  const deletePayment = useDeleteSalaryPayment();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const defaults: DefaultValues<CreateSalaryPaymentInput> = {
    staffId: staff[0]?.id ?? '',
    salaryMonth: month,
    amount: undefined,
    paymentDate: todayIso(settings?.timezone),
    paymentMethod: 'CASH',
    note: '',
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<CreateSalaryPaymentInput>({
    resolver: zodResolver(createSalaryPaymentSchema),
    defaultValues: defaults,
  });

  // "Today" depends on the hostel's timezone, which may still be loading when
  // the dialog opens. Never overwrite a date the user has already picked.
  const dateTouched = dirtyFields.paymentDate === true;
  useEffect(() => {
    if (!settings || dateTouched) return;
    setValue('paymentDate', todayIso(settings.timezone));
  }, [settings, dateTouched, setValue]);

  const staffId = watch('staffId');
  const salaryMonth = watch('salaryMonth');
  const selected = staff.find((member) => member.id === staffId) ?? null;

  // A half-typed month must not be sent to the API.
  const monthReady = isMonthKey(salaryMonth);
  const history = useSalaryList(
    { staffId, month: salaryMonth, pageSize: 50 },
    { enabled: staffId !== '' && monthReady },
  );
  const payments = history.data?.items ?? [];

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const payment = await createPayment.mutateAsync(values);
      toast.success(`${money(payment.amount)} paid to ${payment.staffName}`);
      onClose();
    } catch (error) {
      setSubmitError(errorMessage(error));
      toast.error(errorMessage(error));
    }
  });

  const removePayment = async (id: string, label: string): Promise<void> => {
    const confirmed = await confirm({
      title: 'Remove this salary payment?',
      message: `${label} comes off the register. The month's paid and pending figures are recalculated by the server.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    setRemovingId(id);
    try {
      const result = await deletePayment.mutateAsync(id);
      toast.success(result.reversed ? 'Payment reversed' : 'Payment removed');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Modal
      open
      wide
      title="Record a salary payment"
      onClose={onClose}
      busy={createPayment.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createPayment.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={createPayment.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        noValidate
      >
        <FormError message={submitError} />
        <div className="formgrid" style={{ padding: 0 }}>
          <FormField label="Staff member" error={errors.staffId?.message}>
            {(props) => (
              <select {...props} {...register('staffId')}>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="For month" error={errors.salaryMonth?.message}>
            {(props) => <input {...props} type="month" {...register('salaryMonth')} />}
          </FormField>

          <FormField label="Amount" error={errors.amount?.message}>
            {(props) => (
              <input
                {...props}
                className="num"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                {...register('amount', { valueAsNumber: true })}
              />
            )}
          </FormField>

          <FormField label="Paid on" error={errors.paymentDate?.message}>
            {(props) => <input {...props} type="date" {...register('paymentDate')} />}
          </FormField>

          <FormField label="Method" error={errors.paymentMethod?.message}>
            {(props) => (
              <select {...props} {...register('paymentMethod')}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Note" error={errors.note?.message}>
            {(props) => (
              <input
                {...props}
                type="text"
                placeholder="UPI reference, cheque number…"
                {...register('note')}
              />
            )}
          </FormField>
        </div>
      </form>

      <div style={{ marginTop: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {selected && monthReady
            ? `${selected.name} · ${formatMonthLabel(salaryMonth)}`
            : 'Already recorded'}
        </div>

        <QueryBoundary
          isLoading={history.isLoading}
          error={history.error}
          onRetry={() => void history.refetch()}
          isEmpty={payments.length === 0}
          errorTitle="Could not load the salary payments"
          skeleton={<TableSkeleton rows={2} columns={3} />}
          empty={
            <EmptyState
              title="No salary payments yet"
              message="Anything recorded for this month appears here."
            />
          }
        >
          <div className="deets">
            {payments.map((payment) => {
              const label = `${money(payment.amount)} on ${formatDateLabel(payment.paymentDate)}`;
              return (
                <div key={payment.id}>
                  <span>
                    {formatDateLabel(payment.paymentDate)} ·{' '}
                    {PAYMENT_METHOD_LABELS[payment.paymentMethod]} · {orDash(payment.note)}
                  </span>
                  <span className="inline-actions">
                    <b className="num" style={{ color: 'var(--ink)' }}>
                      {money(payment.amount)}
                    </b>
                    {canManageRecords ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={removingId === payment.id}
                        disabled={removingId !== null}
                        onClick={() => void removePayment(payment.id, label)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </QueryBoundary>
      </div>
    </Modal>
  );
}

/**
 * Record a payment with the full detail the inline ledger cell cannot capture:
 * which billing month, which method, a reference number and a note.
 *
 * The form validates with the shared `createPaymentSchema`, the very schema the
 * API re-validates the request against. The resolver runs in `raw` mode so the
 * values handed to the submit handler are exactly the strings the inputs hold;
 * the request body is then built explicitly, which keeps the types honest.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreatePaymentInput, FeeLedgerRowDto, MonthKey, PaymentMethod } from '@hostel/shared';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  createPaymentSchema,
  formatMonthLabel,
  todayIso,
} from '@hostel/shared';
import { Button } from '../common/Button';
import { FormError, FormField } from '../common/FormField';
import { Modal } from '../common/Modal';
import { useToast } from '../common/ToastProvider';
import { errorMessage } from '../common/states';
import { useCreatePayment } from '../../hooks/useFees';
import { useMoney } from '../../hooks/useSettings';

export interface PaymentFormProps {
  open: boolean;
  onClose: () => void;
  /** The billing month the ledger is showing; the field can be changed. */
  month: MonthKey;
  /** The residents on this month's ledger - no extra request needed. */
  rows: FeeLedgerRowDto[];
  /** Preselect a resident when the form is opened from their row. */
  residentId?: string;
}

interface PaymentFormValues {
  residentId: string;
  billingMonth: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  note: string;
}

export function PaymentForm({
  open,
  onClose,
  month,
  rows,
  residentId,
}: PaymentFormProps): JSX.Element {
  const formId = useId();
  const toast = useToast();
  const { money, settings } = useMoney();
  const createPayment = useCreatePayment();
  const [serverError, setServerError] = useState<string | null>(null);

  // "Today" is the hostel's today, not the browser's incidental locale.
  const today = useMemo(() => todayIso(settings?.timezone), [settings?.timezone]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(createPaymentSchema, undefined, { raw: true }),
    defaultValues: {
      residentId: residentId ?? '',
      billingMonth: month,
      amount: '',
      paymentDate: today,
      paymentMethod: 'CASH',
      referenceNumber: '',
      note: '',
    },
  });

  // Reopening the dialog starts from a clean slate on the current filters.
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    reset({
      residentId: residentId ?? '',
      billingMonth: month,
      amount: '',
      paymentDate: today,
      paymentMethod: 'CASH',
      referenceNumber: '',
      note: '',
    });
  }, [open, month, today, residentId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const input: CreatePaymentInput = {
      residentId: values.residentId,
      billingMonth: values.billingMonth,
      amount: Number(values.amount),
      paymentMethod: values.paymentMethod,
      ...(values.paymentDate ? { paymentDate: values.paymentDate } : {}),
      ...(values.referenceNumber.trim() ? { referenceNumber: values.referenceNumber.trim() } : {}),
      ...(values.note.trim() ? { note: values.note.trim() } : {}),
    };

    try {
      const payment = await createPayment.mutateAsync(input);
      toast.success(
        `Recorded ${money(payment.amount)} for ${payment.residentName} · ${formatMonthLabel(payment.billingMonth)}.`,
      );
      onClose();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Modal
      open={open}
      title="Record a payment"
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
      <FormError message={serverError} />
      <form
        id={formId}
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <div className="formgrid" style={{ padding: 0 }}>
          <FormField label="Resident" error={errors.residentId?.message}>
            {(props) => (
              <select {...props} {...register('residentId')}>
                <option value="">Choose a resident</option>
                {rows.map((row) => (
                  <option key={row.residentId} value={row.residentId}>
                    {row.residentName} · {row.buildingName}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Billing month" error={errors.billingMonth?.message}>
            {(props) => <input {...props} type="month" {...register('billingMonth')} />}
          </FormField>

          <FormField label="Amount" error={errors.amount?.message}>
            {(props) => (
              <input
                {...props}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="num"
                {...register('amount')}
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

          <FormField label="Reference" error={errors.referenceNumber?.message}>
            {(props) => (
              <input {...props} type="text" placeholder="UPI ref, receipt no…" {...register('referenceNumber')} />
            )}
          </FormField>

          <FormField label="Note" error={errors.note?.message}>
            {(props) => <input {...props} type="text" {...register('note')} />}
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

/**
 * "Your data" - what the hostel database holds, and how to get a copy of it.
 *
 * The reference application kept everything in the browser and offered a JSON
 * import/export pair. Production stores it in PostgreSQL, so the counts are read
 * back from the real list endpoints (page 1, one row, `meta.total`) and the
 * actions became server-rendered CSV exports. Restoring is a database operation,
 * not something a browser should attempt, so there is no import button.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { useToast } from '../common/ToastProvider';
import { ErrorState, Skeleton, errorMessage } from '../common/states';
import { expensesApi, exportsApi, paymentsApi, residentsApi, staffApi } from '../../api/resources';
import { queryKeys } from '../../api/queryKeys';
import { usePermissions } from '../../auth/AuthProvider';
import { pluralise, saveBlob } from '../../utils/format';

/** One row is enough - only the pagination total is being read. */
const COUNT_PARAMS = { page: 1, pageSize: 1 } as const;

type ExportKind = 'residents' | 'payments' | 'expenses';

export function DataCard(): JSX.Element {
  const { canManageRecords } = usePermissions();
  const toast = useToast();
  const [downloading, setDownloading] = useState<ExportKind | null>(null);

  const residents = useQuery({
    queryKey: queryKeys.residents.list({ ...COUNT_PARAMS, status: 'all', summary: true }),
    queryFn: () =>
      residentsApi.list({ ...COUNT_PARAMS, status: 'all', includeFees: false }),
    select: (result) => result.meta.total,
  });

  const payments = useQuery({
    queryKey: queryKeys.payments.list({ ...COUNT_PARAMS, summary: true }),
    queryFn: () => paymentsApi.list(COUNT_PARAMS),
    select: (result) => result.meta.total,
  });

  const staff = useQuery({
    queryKey: queryKeys.staff.list({ ...COUNT_PARAMS, summary: true }),
    queryFn: () => staffApi.list(COUNT_PARAMS),
    select: (result) => result.meta.total,
  });

  const expenses = useQuery({
    queryKey: queryKeys.expenses.list({ ...COUNT_PARAMS, summary: true }),
    queryFn: () => expensesApi.list(COUNT_PARAMS),
    select: (result) => result.meta.total,
  });

  const counts = [residents, payments, staff, expenses];
  const isLoading = counts.some((query) => query.isLoading);
  const failed = counts.find((query) => query.error);

  // Built only from four totals the API returned; nothing here is counted in
  // the browser.
  const summary =
    residents.data !== undefined &&
    payments.data !== undefined &&
    staff.data !== undefined &&
    expenses.data !== undefined
      ? `${pluralise(residents.data, 'resident')} · ${pluralise(payments.data, 'fee payment')} · ${pluralise(staff.data, 'staff', 'staff')} · ${pluralise(expenses.data, 'bill')}. Stored in the hostel database and available on every device you sign in from.`
      : null;

  const download = async (kind: ExportKind): Promise<void> => {
    setDownloading(kind);
    try {
      const file = await exportsApi[kind]({ format: 'csv' });
      saveBlob(file.blob, file.fileName);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card title="Your data">
      {isLoading ? (
        <div style={{ padding: '14px 16px' }} aria-busy="true" aria-live="polite">
          <span className="sr-only">Counting what is stored…</span>
          <Skeleton width="92%" />
          <Skeleton width="64%" />
        </div>
      ) : failed?.error ? (
        <ErrorState
          error={failed.error}
          onRetry={() => counts.forEach((query) => void query.refetch())}
          title="Could not count what is stored"
        />
      ) : summary ? (
        <div className="hint" style={{ padding: '14px 16px' }}>
          {summary}
        </div>
      ) : null}

      {canManageRecords ? (
        <div className="imgacts">
          <Button
            variant="ghost"
            onClick={() => void download('residents')}
            loading={downloading === 'residents'}
            disabled={downloading !== null}
          >
            Export residents (CSV)
          </Button>
          <Button
            variant="ghost"
            onClick={() => void download('payments')}
            loading={downloading === 'payments'}
            disabled={downloading !== null}
          >
            Export payments (CSV)
          </Button>
          <Button
            variant="ghost"
            onClick={() => void download('expenses')}
            loading={downloading === 'expenses'}
            disabled={downloading !== null}
          >
            Export expenses (CSV)
          </Button>
        </div>
      ) : null}

      <div className="hint" style={{ padding: '0 16px 16px' }}>
        Backups are not your job any more. The database is snapshotted
        automatically and kept for a rolling window, so a restore is something
        your administrator runs against the server - there is nothing to save to
        this computer and nothing to load back in. The exports above are for
        spreadsheets, audits and sharing.
      </div>
    </Card>
  );
}

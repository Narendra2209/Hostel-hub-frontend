/**
 * The fee-status chip for one ledger row.
 *
 * The status and the days-overdue count are both derived by the backend; this
 * only picks the wording and the class the reference UI used.
 */
import type { FeeLedgerRowDto } from '@hostel/shared';
import { StatusChip } from '../common/StatusChip';

export interface PaymentStatusProps {
  row: Pick<FeeLedgerRowDto, 'status' | 'daysOverdue'>;
}

export function PaymentStatus({ row }: PaymentStatusProps): JSX.Element {
  return <StatusChip status={row.status} daysOverdue={row.daysOverdue} />;
}

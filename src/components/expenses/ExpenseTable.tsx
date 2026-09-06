/**
 * "Bills in {Mon YYYY}" - the expense list from the reference UI.
 *
 * Columns are Date | Building | Category | Note | Amount | (remove), and the
 * header hint is the month total exactly as the API returned it in
 * `meta.totals.total`. Nothing on this screen adds a column of figures up.
 */
import { useState, type ReactNode } from 'react';
import { formatDateLabel, formatDayMonthLabel, formatMonthLabel } from '@hostel/shared';
import type { ExpenseDto, ExpenseListMeta, MonthKey } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card, TableScroll } from '../common/Card';
import { useConfirm } from '../common/ConfirmProvider';
import { Pagination } from '../common/Pagination';
import { BuildingChip } from '../common/StatusChip';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { useToast } from '../common/ToastProvider';
import { useDeleteExpense } from '../../hooks/useExpenses';
import { useMoney } from '../../hooks/useSettings';
import { orDash } from '../../utils/format';

export interface ExpenseTableProps {
  month: MonthKey;
  rows: ExpenseDto[];
  /** Pagination and totals, straight from the list response. */
  meta: ExpenseListMeta | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onEdit: (expense: ExpenseDto) => void;
  /** Hides the row actions for accounts that may not record transactions. */
  canEdit: boolean;
  /** The `.filters` bar, rendered under the card header. */
  filters?: ReactNode;
}

export function ExpenseTable({
  month,
  rows,
  meta,
  isLoading,
  error,
  onRetry,
  onPageChange,
  onEdit,
  canEdit,
  filters,
}: ExpenseTableProps): JSX.Element {
  const { money } = useMoney();
  const confirm = useConfirm();
  const toast = useToast();
  const deleteExpense = useDeleteExpense();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const label = formatMonthLabel(month);

  const onRemove = async (expense: ExpenseDto): Promise<void> => {
    const confirmed = await confirm({
      title: 'Remove this bill?',
      message: `${expense.categoryName} of ${money(expense.amount)} on ${formatDateLabel(
        expense.date,
      )} will no longer count towards this month's costs.`,
      confirmLabel: 'Remove bill',
      tone: 'danger',
    });
    if (!confirmed) return;

    setRemovingId(expense.id);
    try {
      await deleteExpense.mutateAsync(expense.id);
      toast.success('Bill removed.');
    } catch (removeError) {
      toast.error(errorMessage(removeError));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card
      title={`Bills in ${label}`}
      hint={meta ? `Total ${money(meta.totals.total)}` : undefined}
    >
      {filters}
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        errorTitle="Could not load the bills"
        skeleton={<TableSkeleton rows={6} columns={6} />}
        isEmpty={rows.length === 0}
        empty={
          <EmptyState
            title={`No bills for ${label}`}
            message="Log electricity, water, gas, internet or mess costs above."
          />
        }
      >
        <TableScroll>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Building</th>
                <th>Category</th>
                <th>Note</th>
                <th className="r">Amount</th>
                {canEdit ? (
                  <th className="r">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((expense) => (
                <tr key={expense.id}>
                  <td className="num">{formatDayMonthLabel(expense.date)}</td>
                  <td>
                    <BuildingChip name={expense.buildingName} />
                  </td>
                  <td>{expense.categoryName}</td>
                  <td>
                    <div>{orDash(expense.note)}</div>
                    {expense.vendor ? <div className="sub">{expense.vendor}</div> : null}
                  </td>
                  <td className="r num">{money(expense.amount)}</td>
                  {canEdit ? (
                    <td>
                      <div className="inline-actions">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(expense)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={removingId === expense.id}
                          onClick={() => {
                            void onRemove(expense);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </QueryBoundary>
      <Pagination meta={meta} onPageChange={onPageChange} itemLabel="bills" />
    </Card>
  );
}

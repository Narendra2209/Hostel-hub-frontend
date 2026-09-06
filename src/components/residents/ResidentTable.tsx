/**
 * The roster table.
 *
 * Every figure in here was worked out by the API: `currentMonth` is the
 * selected month's position for that resident and `overdue.totalOverdue` is
 * their arrears across every month. Nothing is summed or compared to a due date
 * on this side of the wire.
 */
import { Link } from 'react-router-dom';
import type { MonthKey, ResidentListRowDto } from '@hostel/shared';
import { formatMonthLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { BuildingChip, MonthStatusChip, VacatedChip } from '../common/StatusChip';
import { useMoney } from '../../hooks/useSettings';
import { EM_DASH, dueDayLabel, orDash, owedStyle } from '../../utils/format';

export interface ResidentTableProps {
  rows: ResidentListRowDto[];
  /** The month the API priced these rows for. */
  month: MonthKey;
  /** Query string that carries the month/building filters into the profile. */
  linkSearch: string;
  canEdit: boolean;
  canRemove: boolean;
  onEdit: (resident: ResidentListRowDto) => void;
  onRemove: (resident: ResidentListRowDto) => void;
  /** The row whose removal is in flight. */
  removingId: string | null;
}

/** "Since Mar 2026 · vacated Aug 2026" */
function tenureLabel(row: ResidentListRowDto): string {
  const since = `Since ${formatMonthLabel(row.joinMonth)}`;
  return row.vacatedMonth ? `${since} · vacated ${formatMonthLabel(row.vacatedMonth)}` : since;
}

export function ResidentTable({
  rows,
  month,
  linkSearch,
  canEdit,
  canRemove,
  onEdit,
  onRemove,
  removingId,
}: ResidentTableProps): JSX.Element {
  const { money } = useMoney();
  const showActions = canEdit || canRemove;

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Building</th>
          <th>Phone</th>
          <th className="r">Rent</th>
          <th>Due</th>
          <th>{formatMonthLabel(month)}</th>
          <th className="r">Owed</th>
          {showActions ? <th className="r">Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const leftBeforeThisMonth = row.vacatedMonth !== null && month > row.vacatedMonth;
          return (
            <tr key={row.id}>
              <td>
                <div className="name">
                  <Link className="link" to={{ pathname: `/residents/${row.id}`, search: linkSearch }}>
                    {row.name}
                  </Link>
                </div>
                <div className="sub">{tenureLabel(row)}</div>
              </td>
              <td>
                <BuildingChip name={row.buildingName} />
              </td>
              <td>{orDash(row.phone)}</td>
              <td className="r num">{money(row.monthlyFee)}</td>
              <td>{dueDayLabel(row.dueDay)}</td>
              <td>
                {leftBeforeThisMonth ? <VacatedChip /> : <MonthStatusChip month={row.currentMonth} />}
              </td>
              <td className="r num" style={owedStyle(row.overdue.totalOverdue)}>
                {row.overdue.totalOverdue > 0 ? money(row.overdue.totalOverdue) : EM_DASH}
              </td>
              {showActions ? (
                <td>
                  <div className="inline-actions">
                    {canEdit ? (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                        Edit
                      </Button>
                    ) : null}
                    {canRemove ? (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={removingId === row.id}
                        onClick={() => onRemove(row)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The activity log table: When | Who | Action | Record | What changed.
 *
 * Every value on a row was decided by the API - the action, the resolved actor,
 * the record's label and the field-by-field diff. This component chooses the
 * column order, the chip colour and the wording, and nothing else.
 *
 * Timestamps are rendered in the hostel's timezone rather than the browser's,
 * so a log read from another machine still agrees with the register's dates.
 */
import { Link } from 'react-router-dom';
import type { ActivityEntryDto, AuditAction, AuditEntityType } from '@hostel/shared';
import { APP_TIMEZONE, formatDateLabel, isObjectId, todayIso } from '@hostel/shared';
import { EM_DASH, orDash } from '../../utils/format';
import { TableScroll } from '../common/Card';
import { ChangeList } from './ChangeList';

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/**
 * Chip colours, per the screen's own key: created is good news, removals are
 * red, a move or a restore is amber because it needs reading, and a sign-in is
 * background noise.
 */
const ACTION_CHIP: Record<AuditAction, string> = {
  CREATE: 'chip paid',
  UPDATE: 'chip open',
  DELETE: 'chip late',
  ARCHIVE: 'chip late',
  RESTORE: 'chip part',
  MOVE: 'chip part',
  LOGIN: 'chip off',
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  ARCHIVE: 'Archived',
  RESTORE: 'Restored',
  MOVE: 'Moved',
  LOGIN: 'Signed in',
};

export const ENTITY_LABELS: Record<AuditEntityType, string> = {
  RESIDENT: 'Resident',
  BUILDING: 'Building',
  FEE_PAYMENT: 'Fee payment',
  STAFF: 'Staff',
  SALARY_PAYMENT: 'Salary payment',
  EXPENSE: 'Bill',
  EXPENSE_CATEGORY: 'Bill category',
  SETTINGS: 'Settings',
  USER: 'User account',
  SESSION: 'Session',
};

export function ActionChip({ action }: { action: AuditAction }): JSX.Element {
  return <span className={ACTION_CHIP[action]}>{ACTION_LABELS[action]}</span>;
}

/* ------------------------------------------------------------------ *
 * Timestamps
 * ------------------------------------------------------------------ */

const TIME_OF_DAY = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: APP_TIMEZONE,
});

const FULL_TIMESTAMP = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'full',
  timeStyle: 'long',
  timeZone: APP_TIMEZONE,
});

const parse = (at: string): Date | null => {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "6 Sep 2026", worked out in the hostel's timezone, not the browser's. */
export function activityDate(at: string): string {
  const date = parse(at);
  return date ? formatDateLabel(todayIso(APP_TIMEZONE, date)) : EM_DASH;
}

/** "14:32" - 24-hour, because 3 PM and 3 AM must never be confused in a log. */
export function activityTime(at: string): string {
  const date = parse(at);
  return date ? TIME_OF_DAY.format(date) : EM_DASH;
}

/** The whole thing, spelled out, for the cell's tooltip. */
export function activityTimestamp(at: string): string {
  const date = parse(at);
  return date ? FULL_TIMESTAMP.format(date) : at;
}

/* ------------------------------------------------------------------ *
 * Table
 * ------------------------------------------------------------------ */

/**
 * Where a row's record can still be opened.
 *
 * The DTO carries no "this record still exists" flag, so the two things it does
 * carry stand in for one: a label the server could resolve, and an action that
 * did not destroy the record. A deleted resident's profile would only 404.
 */
function recordHref(entry: ActivityEntryDto): string | null {
  if (entry.entityType !== 'RESIDENT') return null;
  if (entry.action === 'DELETE') return null;
  if (entry.entityLabel === null) return null;
  return isObjectId(entry.entityId) ? `/residents/${entry.entityId}` : null;
}

export interface ActivityTableProps {
  rows: ActivityEntryDto[];
}

export function ActivityTable({ rows }: ActivityTableProps): JSX.Element {
  return (
    <TableScroll>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
            <th>Record</th>
            <th>What changed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => {
            const href = recordHref(entry);
            return (
              <tr key={entry.id}>
                <td title={activityTimestamp(entry.at)} style={{ whiteSpace: 'nowrap' }}>
                  <div className="name">{activityDate(entry.at)}</div>
                  <div className="sub">{activityTime(entry.at)}</div>
                </td>
                <td>
                  <div className="name">{entry.actor.name}</div>
                  <div className="sub">{orDash(entry.actor.role)}</div>
                </td>
                <td>
                  <ActionChip action={entry.action} />
                </td>
                <td>
                  {href ? (
                    <Link className="link" to={href}>
                      {entry.entityLabel}
                    </Link>
                  ) : (
                    <div className="name">{orDash(entry.entityLabel)}</div>
                  )}
                  <div className="sub">{ENTITY_LABELS[entry.entityType]}</div>
                </td>
                <td style={{ minWidth: 220 }}>
                  <ChangeList changes={entry.changes} summary={entry.summary} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

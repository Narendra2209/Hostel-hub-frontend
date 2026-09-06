/**
 * The "What changed" cell of the activity log.
 *
 * The API has already reduced the raw before/after documents to the fields that
 * actually differ and formatted both sides, so this component never inspects a
 * value - it only lays the pairs out and keeps a noisy edit from swamping the
 * table. A CREATE or a DELETE carries no field list at all (the whole record is
 * the change), and for those the server's one-line summary is the change.
 */
import { useState, type CSSProperties } from 'react';
import type { ActivityChangeDto } from '@hostel/shared';
import { EM_DASH } from '../../utils/format';

/** Field lists longer than this collapse behind a toggle. */
const COLLAPSE_AFTER = 3;

/** Values longer than this are cut, with the whole thing left in the tooltip. */
const MAX_VALUE_CHARS = 48;

const LIST: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  minWidth: 0,
};

const ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: 5,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
};

const FIELD: CSSProperties = {
  fontWeight: 600,
};

const BEFORE: CSSProperties = {
  color: 'var(--muted)',
};

const ARROW: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 11,
};

// A text button that inherits the row's type rather than looking like a control.
const TOGGLE: CSSProperties = {
  background: 'none',
  border: 0,
  margin: 0,
  padding: 0,
  font: 'inherit',
  fontSize: 12,
  color: 'var(--teal)',
  cursor: 'pointer',
  textAlign: 'left',
};

/** `monthlyFee` / `due_day` / `resident.name` -> `Monthly fee`, `Due day`, `Resident name`. */
export function fieldLabel(field: string): string {
  const words = field
    .replace(/[._]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words.length === 0 ? field : words.charAt(0).toUpperCase() + words.slice(1);
}

/** Blank sides render as an em dash: "unset" is a real, meaningful value here. */
function shorten(value: string | null): { text: string; title: string | undefined } {
  if (value === null || value.trim().length === 0) return { text: EM_DASH, title: undefined };
  const trimmed = value.trim();
  return trimmed.length > MAX_VALUE_CHARS
    ? { text: `${trimmed.slice(0, MAX_VALUE_CHARS)}…`, title: trimmed }
    : { text: trimmed, title: undefined };
}

export interface ChangeListProps {
  changes: ActivityChangeDto[];
  /** Shown instead of the pairs when there are none - CREATE, DELETE, LOGIN. */
  summary: string | null;
  collapseAfter?: number;
}

export function ChangeList({
  changes,
  summary,
  collapseAfter = COLLAPSE_AFTER,
}: ChangeListProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  if (changes.length === 0) {
    return summary ? (
      <span className="sub" style={{ overflowWrap: 'anywhere' }}>
        {summary}
      </span>
    ) : (
      <span className="sub">{EM_DASH}</span>
    );
  }

  const collapsible = changes.length > collapseAfter;
  const visible = collapsible && !expanded ? changes.slice(0, collapseAfter) : changes;
  const hiddenCount = changes.length - visible.length;

  return (
    <div style={LIST}>
      {visible.map((change, index) => {
        const before = shorten(change.before);
        const after = shorten(change.after);
        return (
          <div key={`${change.field}-${index}`} style={ROW}>
            <span style={FIELD}>{fieldLabel(change.field)}:</span>
            <span style={BEFORE} title={before.title}>
              {before.text}
            </span>
            <span style={ARROW} aria-hidden="true">
              →
            </span>
            <span title={after.title}>{after.text}</span>
          </div>
        );
      })}

      {collapsible ? (
        <button
          type="button"
          style={TOGGLE}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'show less' : `show all ${changes.length}`}
        </button>
      ) : null}

      {/* Screen readers should not be told a field list is complete when three
          of nine are on screen. */}
      {hiddenCount > 0 ? (
        <span className="sr-only">{hiddenCount} more field(s) not shown</span>
      ) : null}
    </div>
  );
}

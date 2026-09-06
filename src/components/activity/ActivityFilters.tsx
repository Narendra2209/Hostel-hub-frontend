/**
 * The activity log's filter bar.
 *
 * The entity-type and actor lists come from `meta.filters` - i.e. from what is
 * actually in the log - so the selects never offer a choice that returns
 * nothing, and a hostel that has never touched a bill category is not asked
 * about one. Only the action list is fixed, because it is a closed set the
 * database itself enforces.
 *
 * Every control writes straight to the URL through the page's setters. The
 * search box is the one exception: it types locally and settles after a beat,
 * so one keystroke is not one request and not one history entry.
 */
import { useEffect, useRef, useState } from 'react';
import type { ActivityFiltersDto } from '@hostel/shared';
import { AUDIT_ACTIONS } from '@hostel/shared';
import { Button } from '../common/Button';
import { ACTION_LABELS, ENTITY_LABELS } from './ActivityTable';

/** How long the search box waits before it commits a keystroke to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

export interface ActivityFilterValues {
  entityType: string;
  actorId: string;
  action: string;
  /** Inclusive ISO dates from the two `<input type="date">` controls. */
  from: string;
  to: string;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilterValues = {
  entityType: '',
  actorId: '',
  action: '',
  from: '',
  to: '',
};

export interface ActivityFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  values: ActivityFilterValues;
  onChange: (patch: Partial<ActivityFilterValues>) => void;
  /** Undefined until the first page has loaded; the selects stay disabled. */
  options: ActivityFiltersDto | undefined;
}

export function ActivityFilters({
  search,
  onSearchChange,
  values,
  onChange,
  options,
}: ActivityFiltersProps): JSX.Element {
  const [draft, setDraft] = useState(search);
  const timer = useRef<number | undefined>(undefined);

  // The URL is the source of truth: a back button or a cleared filter must be
  // reflected in the box.
  useEffect(() => setDraft(search), [search]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onType = (value: string): void => {
    setDraft(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onSearchChange(value), SEARCH_DEBOUNCE_MS);
  };

  const clearAll = (): void => {
    window.clearTimeout(timer.current);
    setDraft('');
    onSearchChange('');
    onChange(EMPTY_ACTIVITY_FILTERS);
  };

  const entityTypes = options?.entityTypes ?? [];
  const actors = options?.actors ?? [];
  const anyActive =
    search.length > 0 || Object.values(values).some((value) => value.length > 0);

  return (
    <div className="filters">
      <input
        className="search"
        type="search"
        value={draft}
        placeholder="Search people, records and notes"
        aria-label="Search the activity log"
        onChange={(event) => onType(event.target.value)}
      />

      <select
        value={values.entityType}
        aria-label="Kind of record"
        disabled={options === undefined}
        onChange={(event) => onChange({ entityType: event.target.value })}
      >
        <option value="">All records</option>
        {entityTypes.map((type) => (
          <option key={type} value={type}>
            {ENTITY_LABELS[type]}
          </option>
        ))}
      </select>

      <select
        value={values.actorId}
        aria-label="Who made the change"
        disabled={options === undefined}
        onChange={(event) => onChange({ actorId: event.target.value })}
      >
        <option value="">Everyone</option>
        {actors.map((actor) => (
          <option key={actor.id} value={actor.id}>
            {actor.name}
          </option>
        ))}
      </select>

      <select
        value={values.action}
        aria-label="What was done"
        onChange={(event) => onChange({ action: event.target.value })}
      >
        <option value="">Every action</option>
        {AUDIT_ACTIONS.map((action) => (
          <option key={action} value={action}>
            {ACTION_LABELS[action]}
          </option>
        ))}
      </select>

      <div className="picker">
        <label htmlFor="activityFrom">From</label>
        <input
          id="activityFrom"
          type="date"
          value={values.from}
          max={values.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </div>

      <div className="picker">
        <label htmlFor="activityTo">To</label>
        <input
          id="activityTo"
          type="date"
          value={values.to}
          min={values.from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </div>

      <div style={{ flex: 1 }} />

      {anyActive ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

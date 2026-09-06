/**
 * The sticky header: page title plus the global building and month pickers.
 *
 * Both pickers write to the URL, so they survive a refresh and can be shared.
 */
import { useBuildings } from '../../hooks/useSettings';
import { useFilters } from '../../hooks/useFilters';
import { ALL_BUILDINGS } from '@hostel/shared';
import type { ReactNode } from 'react';

export interface TopBarProps {
  title: ReactNode;
  /** Hides the pickers on screens where they mean nothing (Settings). */
  showFilters?: boolean;
  showMonth?: boolean;
  showBuilding?: boolean;
  actions?: ReactNode;
}

export function TopBar({
  title,
  showFilters = true,
  showMonth = true,
  showBuilding = true,
  actions,
}: TopBarProps): JSX.Element {
  const { month, buildingId, setMonth, setBuilding } = useFilters();
  const { data: buildings, isLoading } = useBuildings();

  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div className="spacer" />
      {actions}

      {showFilters && showBuilding ? (
        <div className="picker">
          <label htmlFor="bldFilter">Building</label>
          <select
            id="bldFilter"
            value={buildingId}
            onChange={(event) => setBuilding(event.target.value)}
            disabled={isLoading}
          >
            <option value={ALL_BUILDINGS}>All buildings</option>
            {(buildings ?? []).map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showFilters && showMonth ? (
        <div className="picker">
          <label htmlFor="monthInput">Month</label>
          <input
            id="monthInput"
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

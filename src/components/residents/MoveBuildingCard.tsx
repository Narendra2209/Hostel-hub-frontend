/**
 * Move a resident to another building, and the trail of past transfers.
 *
 * The transfer history comes back with the profile, so this card never issues a
 * request of its own until somebody actually moves.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ResidentDto, ResidentMoveDto } from '@hostel/shared';
import { formatDateLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { errorMessage } from '../common/states';
import { useToast } from '../common/ToastProvider';
import { usePermissions } from '../../auth/AuthProvider';
import { useBuildings } from '../../hooks/useSettings';
import { useMoveResident } from '../../hooks/useResidents';
import { EM_DASH } from '../../utils/format';

export interface MoveBuildingCardProps {
  resident: ResidentDto;
  moves: ResidentMoveDto[];
}

export function MoveBuildingCard({ resident, moves }: MoveBuildingCardProps): JSX.Element {
  const permissions = usePermissions();
  const toast = useToast();
  const { data: buildings, isLoading } = useBuildings();
  const move = useMoveResident();

  const destinations = useMemo(
    () => (buildings ?? []).filter((building) => building.id !== resident.buildingId),
    [buildings, resident.buildingId],
  );
  const [target, setTarget] = useState('');

  // Default to the first building they are not already in, and drop the choice
  // again once they have been moved there.
  useEffect(() => {
    setTarget((current) =>
      destinations.some((building) => building.id === current) ? current : (destinations[0]?.id ?? ''),
    );
  }, [destinations]);

  const onMove = async (): Promise<void> => {
    if (!target) return;
    try {
      await move.mutateAsync({ id: resident.id, input: { toBuildingId: target } });
      const name = destinations.find((building) => building.id === target)?.name ?? 'the new building';
      toast.success(`${resident.name} now lives in ${name}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Card title="Move to another building">
      {permissions.canManageRecords ? (
        <div className="bldline">
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            disabled={isLoading || destinations.length === 0}
            aria-label="Building to move to"
          >
            {destinations.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            loading={move.isPending}
            disabled={!target}
            onClick={() => void onMove()}
          >
            Move
          </Button>
        </div>
      ) : null}

      {moves.length === 0 ? (
        <div className="hint" style={{ padding: '12px 16px' }}>
          No transfers recorded.
        </div>
      ) : (
        moves.map((entry) => (
          <div className="catrow" key={entry.id}>
            <span className="sub">{formatDateLabel(entry.effectiveDate)}</span>
            <span>
              {entry.fromBuildingName ?? EM_DASH} → {entry.toBuildingName}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}

/**
 * "Buildings" - rename, add and remove the buildings every other screen filters
 * by.
 *
 * Names are edited locally and saved in one go, so a manager can correct three
 * buildings and press one button. Only the rows whose name actually changed are
 * PATCHed. Whether a building may be removed is the server's decision: the DTO
 * carries `deletable`, and if the API refuses anyway its message is shown
 * verbatim.
 */
import { useState } from 'react';
import type { BuildingDto } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { useConfirm } from '../common/ConfirmProvider';
import { useToast } from '../common/ToastProvider';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../common/states';
import { useBuildings } from '../../hooks/useSettings';
import {
  useCreateBuilding,
  useDeleteBuilding,
  useUpdateBuilding,
} from '../../hooks/useBuildingMutations';
import { usePermissions } from '../../auth/AuthProvider';
import { pluralise } from '../../utils/format';

/** Why the server has locked this building down, phrased from its own counts. */
function blockedReason(building: BuildingDto): string | undefined {
  if (building.deletable) return undefined;
  const attached: string[] = [];
  if (building.totalResidentCount > 0) {
    attached.push(pluralise(building.totalResidentCount, 'resident'));
  }
  if (building.staffCount > 0) attached.push(pluralise(building.staffCount, 'staff member'));
  if (building.expenseCount > 0) attached.push(pluralise(building.expenseCount, 'bill'));
  return attached.length > 0
    ? `Still has ${attached.join(' · ')} on record. Move them to another building first.`
    : 'This building still has records attached and cannot be removed.';
}

export function BuildingsCard(): JSX.Element | null {
  const { canManageRecords, canAdminister } = usePermissions();
  const buildingsQuery = useBuildings();
  const createBuilding = useCreateBuilding();
  const updateBuilding = useUpdateBuilding();
  const deleteBuilding = useDeleteBuilding();
  const confirm = useConfirm();
  const toast = useToast();

  /** Edited names only; anything absent still shows the stored name. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingNames, setSavingNames] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!canManageRecords) return null;

  const buildings = buildingsQuery.data ?? [];
  const nameOf = (building: BuildingDto): string => drafts[building.id] ?? building.name;
  const changed = buildings
    .map((building) => ({ building, name: nameOf(building).trim() }))
    .filter((row) => row.name !== row.building.name);

  const onSaveNames = async (): Promise<void> => {
    if (changed.some((row) => row.name.length === 0)) {
      toast.error('Every building needs a name.');
      return;
    }
    setSavingNames(true);
    try {
      await Promise.all(
        changed.map((row) =>
          updateBuilding.mutateAsync({ id: row.building.id, input: { name: row.name } }),
        ),
      );
      setDrafts({});
      toast.success(`Saved ${pluralise(changed.length, 'name')}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingNames(false);
    }
  };

  const onAddBuilding = async (): Promise<void> => {
    try {
      const created = await createBuilding.mutateAsync({
        name: 'New building',
        active: true,
        sortOrder: buildings.length,
      });
      toast.success(`${created.name} added`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onRemove = async (building: BuildingDto): Promise<void> => {
    const confirmed = await confirm({
      title: `Remove ${building.name}?`,
      message:
        'It disappears from every building filter. Residents, staff and bills attached to it must be moved first.',
      confirmLabel: 'Remove building',
      tone: 'danger',
    });
    if (!confirmed) return;

    setRemovingId(building.id);
    try {
      await deleteBuilding.mutateAsync(building.id);
      setDrafts((current) => {
        const next = { ...current };
        delete next[building.id];
        return next;
      });
      toast.success(`${building.name} removed`);
    } catch (error) {
      // The API re-checks dependants; its refusal is the message worth reading.
      toast.error(errorMessage(error));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card title="Buildings" hint="Rename to match your own names">
      <QueryBoundary
        isLoading={buildingsQuery.isLoading}
        error={buildingsQuery.error}
        onRetry={() => void buildingsQuery.refetch()}
        isEmpty={buildings.length === 0}
        errorTitle="Could not load the buildings"
        skeleton={<TableSkeleton rows={3} columns={3} />}
        empty={
          <EmptyState
            title="No buildings yet"
            message="Add one so residents, bills and salaries can be grouped."
          />
        }
      >
        {buildings.map((building) => {
          const reason = blockedReason(building);
          return (
            <div className="bldline" key={building.id}>
              <input
                type="text"
                value={nameOf(building)}
                aria-label={`Name for ${building.name}`}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [building.id]: event.target.value }))
                }
              />
              <span className="hint num">{building.residentCount} staying</span>
              {canAdminister ? (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!building.deletable || removingId !== null}
                  loading={removingId === building.id}
                  title={reason}
                  onClick={() => void onRemove(building)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          );
        })}
      </QueryBoundary>

      <div className="imgacts">
        <Button
          onClick={() => void onSaveNames()}
          loading={savingNames}
          disabled={buildingsQuery.isLoading || changed.length === 0}
        >
          Save names
        </Button>
        <Button
          variant="ghost"
          onClick={() => void onAddBuilding()}
          loading={createBuilding.isPending}
          disabled={buildingsQuery.isLoading}
        >
          Add a building
        </Button>
      </div>
    </Card>
  );
}

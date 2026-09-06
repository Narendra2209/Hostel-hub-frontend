/**
 * Resident profile (`/residents/:residentId`).
 *
 * One request - `GET /api/residents/:id/profile` - returns the resident, their
 * lifetime totals, this month's position, every billable month, every payment
 * and every building transfer. The only other call is the Jan-Dec fee strip,
 * which is year-scoped and lives in its own card.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { ALL_BUILDINGS } from '@hostel/shared';
import { TopBar } from '../components/layout/TopBar';
import { PageBody } from '../components/layout/AppShell';
import { Button } from '../components/common/Button';
import { ErrorState, LoadingState } from '../components/common/states';
import { MoveBuildingCard } from '../components/residents/MoveBuildingCard';
import { ResidentDocuments } from '../components/residents/ResidentDocuments';
import { ResidentPhoto } from '../components/residents/ResidentPhoto';
import { ResidentProfile } from '../components/residents/ResidentProfile';
import { useFilters } from '../hooks/useFilters';
import { useResidentProfile } from '../hooks/useResidents';
import { usePermissions } from '../auth/AuthProvider';

export function ResidentProfilePage(): JSX.Element {
  const { residentId = '' } = useParams<{ residentId: string }>();
  const { month, buildingId } = useFilters();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const profile = useResidentProfile(residentId, month);
  const resident = profile.data?.resident;

  // Carry the month and building filters back to the list, and into the edit
  // form, so the context the profile was opened from is not lost.
  const search = `?month=${month}${buildingId !== ALL_BUILDINGS ? `&building=${buildingId}` : ''}`;

  return (
    <>
      <TopBar title={resident?.name ?? 'Resident'} />
      <PageBody>
        <div className="inline-actions" style={{ justifyContent: 'flex-start', marginBottom: 18 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ pathname: '/residents', search })}
          >
            ← All residents
          </Button>
          {permissions.canManageRecords && resident ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate({ pathname: '/residents', search: `${search}&edit=${resident.id}` })
              }
            >
              Edit details
            </Button>
          ) : null}
        </div>

        {profile.isLoading ? (
          <LoadingState label="Loading the resident…" />
        ) : profile.error ? (
          <ErrorState
            error={profile.error}
            onRetry={() => void profile.refetch()}
            title="Could not load this resident"
          />
        ) : profile.data ? (
          <div className="profile">
            <div className="stack">
              <ResidentPhoto resident={profile.data.resident} />
              <ResidentDocuments resident={profile.data.resident} />
              <MoveBuildingCard resident={profile.data.resident} moves={profile.data.moves} />
            </div>
            <ResidentProfile profile={profile.data} />
          </div>
        ) : null}
      </PageBody>
    </>
  );
}

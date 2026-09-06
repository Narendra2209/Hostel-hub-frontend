/**
 * Residents (`/residents`).
 *
 * The add/edit form sits above the roster, exactly as in the reference UI. The
 * search box, the status filter, the page number and the resident being edited
 * all live in the query string, so the screen is shareable and survives a
 * refresh.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ResidentListRowDto } from '@hostel/shared';
import { ALL_BUILDINGS } from '@hostel/shared';
import { TopBar } from '../components/layout/TopBar';
import { PageBody } from '../components/layout/AppShell';
import { Card, TableScroll } from '../components/common/Card';
import { Pagination } from '../components/common/Pagination';
import { EmptyState, QueryBoundary, TableSkeleton, errorMessage } from '../components/common/states';
import { useConfirm } from '../components/common/ConfirmProvider';
import { useToast } from '../components/common/ToastProvider';
import { ResidentForm } from '../components/residents/ResidentForm';
import { ResidentTable } from '../components/residents/ResidentTable';
import { useFilters, useListParams } from '../hooks/useFilters';
import { useBuildingName } from '../hooks/useSettings';
import { useArchiveResident, useResidentList } from '../hooks/useResidents';
import { usePermissions } from '../auth/AuthProvider';
import type { ResidentListParams } from '../api/resources';

const STATUS_OPTIONS = [
  { value: 'staying', label: 'Staying' },
  { value: 'vacated', label: 'Vacated' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
] as const;

type ResidentStatus = (typeof STATUS_OPTIONS)[number]['value'];

const asStatus = (value: string): ResidentStatus => {
  const match = STATUS_OPTIONS.find((option) => option.value === value);
  return match ? match.value : 'staying';
};

const SEARCH_DEBOUNCE_MS = 300;

export function ResidentsPage(): JSX.Element {
  const { month, buildingId } = useFilters();
  const list = useListParams({ status: 'staying' });
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();

  const editingId = searchParams.get('edit');
  const buildingName = useBuildingName(buildingId);

  const setEditing = (residentId: string | null): void => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (residentId) next.set('edit', residentId);
        else next.delete('edit');
        return next;
      },
      { replace: true },
    );
  };

  // The search box types locally and only writes to the URL once the person
  // stops typing, so every keystroke does not become a request or a history
  // entry.
  const [term, setTerm] = useState(list.search);
  const setSearchRef = useRef(list.setSearch);
  useEffect(() => {
    setSearchRef.current = list.setSearch;
  });
  useEffect(() => {
    if (term === list.search) return;
    const timer = window.setTimeout(() => setSearchRef.current(term), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term, list.search]);

  const params: ResidentListParams = {
    page: list.page,
    pageSize: list.pageSize,
    search: list.search || undefined,
    buildingId,
    month,
    status: asStatus(list.status),
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };

  const residents = useResidentList(params);
  const archive = useArchiveResident();
  const meta = residents.data?.meta;
  const rows = residents.data?.items ?? [];

  const linkSearch = `?month=${month}${buildingId !== ALL_BUILDINGS ? `&building=${buildingId}` : ''}`;

  const onRemove = async (resident: ResidentListRowDto): Promise<void> => {
    // A resident with payments on record is archived, never deleted - the books
    // must keep pointing at a real person.
    const knownPayments = resident.currentMonth.paymentCount > 0;
    const ok = await confirm({
      title: `Remove ${resident.name}?`,
      message: knownPayments
        ? `${resident.name} has payments on record, so they will be archived rather than deleted. Their payment history is kept.`
        : `${resident.name} will be taken off the roster. If any payments are on record they are archived instead of deleted, so the payment history is kept.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const result = await archive.mutateAsync(resident.id);
      toast.success(
        result.archived
          ? `${resident.name} was archived; their payment history is kept.`
          : `${resident.name} was removed.`,
      );
      if (editingId === resident.id) setEditing(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <TopBar title="Residents" />
      <PageBody>
        <div className="stack">
          {permissions.canManageRecords ? (
            <ResidentForm editingId={editingId} onDone={() => setEditing(null)} />
          ) : null}

          <Card
            title={buildingId === ALL_BUILDINGS ? 'Everyone' : buildingName}
            hint={meta ? `${meta.stayingCount} staying · ${meta.totalOnRecord} on record` : undefined}
          >
            <div className="filters">
              <input
                className="search"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search by name or phone"
                aria-label="Search residents"
              />
              <select
                value={asStatus(list.status)}
                onChange={(event) => list.setStatus(event.target.value)}
                aria-label="Resident status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <QueryBoundary
              isLoading={residents.isLoading}
              error={residents.error}
              onRetry={() => void residents.refetch()}
              isEmpty={rows.length === 0}
              errorTitle="Could not load the residents"
              skeleton={<TableSkeleton rows={6} columns={7} />}
              empty={
                <EmptyState
                  title="Nobody here yet"
                  message="Use the form above to add the first resident."
                />
              }
            >
              <TableScroll>
                {/* A page that is being replaced dims, so a stale row is never
                    mistaken for a fresh one. */}
                <div style={{ opacity: residents.isPlaceholderData ? 0.6 : 1 }}>
                  <ResidentTable
                    rows={rows}
                    month={meta?.month ?? month}
                    linkSearch={linkSearch}
                    canEdit={permissions.canManageRecords}
                    canRemove={permissions.canAdminister}
                    onEdit={(resident) => setEditing(resident.id)}
                    onRemove={(resident) => void onRemove(resident)}
                    removingId={archive.isPending ? (archive.variables ?? null) : null}
                  />
                </div>
              </TableScroll>
            </QueryBoundary>

            <Pagination
              meta={meta}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              itemLabel="residents"
            />
          </Card>
        </div>
      </PageBody>
    </>
  );
}

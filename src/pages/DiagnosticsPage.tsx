/**
 * Diagnostics - how the server itself is doing.
 *
 * Everything here describes the process and the database, not the hostel, so
 * the screen carries no month or building picker and none of the figures are
 * money. It is a live reading: the snapshot refreshes every fifteen seconds
 * while the page is open and stops the moment it is left, because a diagnostic
 * that keeps polling from a closed tab is just load.
 *
 * Visibility is a capability, not a rank: OWNER and DEVELOPER only. The API
 * enforces that; the check here decides whether to ask at all.
 */
import { useCallback } from 'react';
import type { DiagnosticsDto } from '@hostel/shared';
import { ApiClientError } from '../api/client';
import { usePermissions } from '../auth/AuthProvider';
import { Card, StatCard, StatGrid, TableScroll } from '../components/common/Card';
import {
  EmptyState,
  QueryBoundary,
  StatsSkeleton,
  TableSkeleton,
} from '../components/common/states';
import { PageBody } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { DIAGNOSTICS_REFRESH_MS, useDiagnostics } from '../hooks/useActivity';
import { activityTimestamp } from '../components/activity/ActivityTable';

/* ------------------------------------------------------------------ *
 * Formatting
 *
 * Presentation only. Every number below arrived from the API already measured;
 * nothing here computes a figure, it only chooses a unit.
 * ------------------------------------------------------------------ */

const COUNT = new Intl.NumberFormat('en-IN');

/** 1 KB is 1024 B here, matching what MongoDB and `process.memoryUsage()` report. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  const unit = units[exponent] ?? 'B';
  return `${value.toFixed(exponent === 0 ? 0 : value >= 100 ? 0 : 1)} ${unit}`;
}

/** "3d 4h", "4h 12m", "12m 30s" - the two largest units that are non-zero. */
function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1) return 'just started';
  const whole = Math.floor(seconds);
  const days = Math.floor(whole / 86_400);
  const hours = Math.floor((whole % 86_400) / 3_600);
  const minutes = Math.floor((whole % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${whole % 60}s`;
  return `${whole}s`;
}

/** A rate the API sends as 0-1, shown as a whole percentage. */
const formatRate = (rate: number): string =>
  Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : '—';

/** Milliseconds, kept to one decimal below 10ms where the difference matters. */
const formatMs = (ms: number): string =>
  Number.isFinite(ms) ? `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms` : '—';

/* ------------------------------------------------------------------ *
 * Panels
 * ------------------------------------------------------------------ */

function CollectionsCard({ database }: { database: DiagnosticsDto['database'] }): JSX.Element {
  // Biggest first: the collection worth knowing about is the one that grew.
  const collections = [...database.collections].sort((a, b) => b.sizeBytes - a.sizeBytes);

  return (
    <Card
      title="Collections"
      hint={`${collections.length} in ${database.name}`}
    >
      {collections.length === 0 ? (
        <EmptyState
          title="No collections reported"
          message="The database answered, but listed nothing to measure."
        />
      ) : (
        <TableScroll>
          <table>
            <thead>
              <tr>
                <th>Collection</th>
                <th className="r">Documents</th>
                <th className="r">Indexes</th>
                <th className="r">Size</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.name}>
                  <td className="name">{collection.name}</td>
                  <td className="r">{COUNT.format(collection.documents)}</td>
                  <td className="r">{COUNT.format(collection.indexes)}</td>
                  <td className="r">{formatBytes(collection.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>All collections</td>
                <td className="r">{COUNT.format(database.totalDocuments)}</td>
                <td className="r" />
                <td className="r">{formatBytes(database.storageBytes)}</td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      )}
    </Card>
  );
}

function CachesCard({ caches }: { caches: DiagnosticsDto['caches'] }): JSX.Element {
  return (
    <Card title="Caches" hint="Hit rates since this container started">
      {caches.length === 0 ? (
        <EmptyState
          title="No caches in use"
          message="Nothing has been cached in this process yet."
        />
      ) : (
        <TableScroll>
          <table>
            <thead>
              <tr>
                <th>Cache</th>
                <th className="r">Entries</th>
                <th className="r">Hits</th>
                <th className="r">Misses</th>
                <th className="r">Hit rate</th>
              </tr>
            </thead>
            <tbody>
              {caches.map((cache) => (
                <tr key={cache.name}>
                  <td className="name">{cache.name}</td>
                  <td className="r">{COUNT.format(cache.entries)}</td>
                  <td className="r">{COUNT.format(cache.hits)}</td>
                  <td className="r">{COUNT.format(cache.misses)}</td>
                  <td className="r">
                    {/* A cache that is missing more than it hits is worth a second look. */}
                    <span className={cache.hitRate >= 0.5 ? 'chip paid' : 'chip part'}>
                      {formatRate(cache.hitRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  );
}

function TimingsCard({ timings }: { timings: DiagnosticsDto['timings'] }): JSX.Element {
  return (
    <Card title="Slowest routes" hint="Observed by this container since it started">
      {timings.length === 0 ? (
        <EmptyState
          title="No requests timed yet"
          message="Timings appear once this container has served a few requests."
        />
      ) : (
        <TableScroll>
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th className="r">Requests</th>
                <th className="r">p50</th>
                <th className="r">p95</th>
                <th className="r">Slowest</th>
              </tr>
            </thead>
            <tbody>
              {timings.map((timing) => (
                <tr key={timing.route}>
                  <td className="name">{timing.route}</td>
                  <td className="r">{COUNT.format(timing.count)}</td>
                  <td className="r">{formatMs(timing.p50Ms)}</td>
                  <td className="r">{formatMs(timing.p95Ms)}</td>
                  <td className="r">{formatMs(timing.maxMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export function DiagnosticsPage(): JSX.Element {
  const { canViewDiagnostics } = usePermissions();

  const query = useDiagnostics({ enabled: canViewDiagnostics });
  const forbidden = canViewDiagnostics
    ? null
    : new ApiClientError('Diagnostics are available to owners and developers.', 'FORBIDDEN', 403);

  const data = query.data;
  const error: unknown = forbidden ?? query.error;
  const isLoading = canViewDiagnostics && query.isLoading;

  // A refusal is a refusal whether it came from here or from the API, and
  // neither is worth a "Try again" button.
  const refused = error instanceof ApiClientError && error.isPermissionError;

  const retry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const refreshSeconds = Math.round(DIAGNOSTICS_REFRESH_MS / 1000);

  return (
    <>
      {/* Nothing here is scoped to a month or a building. */}
      <TopBar title="Diagnostics" showFilters={false} />
      <PageBody>
        {/* Figures stay skeletons until they are real, and a failure is reported
            once, by the panel below, which owns the retry. */}
        {isLoading ? (
          <StatsSkeleton count={4} />
        ) : data ? (
          <>
            <StatGrid>
              <StatCard
                eyebrow="Database size"
                value={formatBytes(data.database.storageBytes)}
                tone={data.database.connected ? 'ok' : 'late'}
                foot={data.database.connected ? data.database.name : 'not connected'}
              />
              <StatCard
                eyebrow="Documents"
                value={COUNT.format(data.database.totalDocuments)}
                foot={`across ${data.database.collections.length} collections`}
              />
              <StatCard
                eyebrow="Uptime"
                value={formatUptime(data.runtime.uptimeSeconds)}
                valueStyle={{ fontSize: 19 }}
                foot={`${data.runtime.environment} · Node ${data.runtime.nodeVersion}`}
              />
              <StatCard
                eyebrow="Heap used"
                value={`${COUNT.format(Math.round(data.runtime.memoryMb.heapUsed))} MB`}
                valueStyle={{ fontSize: 19 }}
                foot={`of ${COUNT.format(Math.round(data.runtime.memoryMb.heapTotal))} MB heap · ${COUNT.format(
                  Math.round(data.runtime.memoryMb.rss),
                )} MB resident`}
              />
            </StatGrid>

            <p className="hint" style={{ margin: '-6px 0 16px' }}>
              Read at {activityTimestamp(data.generatedAt)}. Refreshes every {refreshSeconds}{' '}
              seconds while this page is open.
            </p>
          </>
        ) : null}

        <div className="stack">
          <QueryBoundary
            isLoading={isLoading}
            error={error}
            onRetry={refused ? undefined : retry}
            isEmpty={!isLoading && !error && !data}
            errorTitle={refused ? undefined : 'Could not read diagnostics'}
            skeleton={<TableSkeleton rows={6} columns={4} />}
            empty={
              <Card title="Collections">
                <EmptyState
                  title="No reading available"
                  message="The server answered without a diagnostics snapshot."
                />
              </Card>
            }
          >
            {data ? (
              <>
                <CollectionsCard database={data.database} />
                <CachesCard caches={data.caches} />
                <TimingsCard timings={data.timings} />
              </>
            ) : null}
          </QueryBoundary>
        </div>
      </PageBody>
    </>
  );
}

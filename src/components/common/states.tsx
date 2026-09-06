/**
 * Loading, empty and error states.
 *
 * A rule this app takes seriously: never render a zero while data is still
 * loading. A hostel manager reading "₹0 collected" cannot tell the difference
 * between "nothing came in" and "still fetching", so every figure is a skeleton
 * until the real number arrives.
 */
import type { ReactNode } from 'react';
import { ApiClientError } from '../../api/client';
import { Button } from './Button';

/* ---------- empty ---------- */

export interface EmptyStateProps {
  /** The bold headline, exactly as the reference UI phrased it. */
  title: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="empty">
      <b>{title}</b>
      {message}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

/* ---------- loading ---------- */

export function Skeleton({
  width = '100%',
  height,
  variant = 'line',
}: {
  width?: string | number;
  height?: number;
  variant?: 'line' | 'tall' | 'block';
}): JSX.Element {
  return (
    <span
      className={`skel ${variant}`}
      style={{ width, ...(height ? { height } : {}) }}
      aria-hidden="true"
    />
  );
}

/** Skeleton rows shaped like the table that is about to appear. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}): JSX.Element {
  return (
    <div style={{ padding: '14px 16px' }} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              width={columnIndex === 0 ? '28%' : `${Math.round(60 / (columns - 1))}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }): JSX.Element {
  return (
    <div className="stats" aria-busy="true">
      <span className="sr-only">Loading figures…</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="stat" key={index}>
          <div className="bar" />
          <Skeleton width="55%" height={10} />
          <div style={{ marginTop: 9 }}>
            <Skeleton width="70%" variant="tall" />
          </div>
          <div style={{ marginTop: 6 }}>
            <Skeleton width="45%" height={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }): JSX.Element {
  return (
    <div className="page-state" aria-busy="true" aria-live="polite">
      <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
      <span>{label}</span>
    </div>
  );
}

/* ---------- error ---------- */

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Shown above the message, e.g. "Could not load the fee ledger". */
  title?: string;
}

/** Turns any thrown value into a sentence worth showing someone. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export function ErrorState({ error, onRetry, title }: ErrorStateProps): JSX.Element {
  const permission = error instanceof ApiClientError && error.isPermissionError;
  return (
    <div className="page-state error-state" role="alert">
      <b>{title ?? (permission ? 'You do not have access to this' : 'That did not load')}</b>
      <span>{errorMessage(error)}</span>
      {onRetry && !permission ? (
        <div className="actions">
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The standard three-state wrapper for a data-driven panel.
 * Keeps every screen's loading/error/empty handling identical.
 */
export function QueryBoundary({
  isLoading,
  error,
  onRetry,
  isEmpty,
  empty,
  skeleton,
  errorTitle,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  errorTitle?: string;
  children: ReactNode;
}): JSX.Element {
  if (isLoading) return <>{skeleton ?? <TableSkeleton />}</>;
  if (error) return <ErrorState error={error} onRetry={onRetry} title={errorTitle} />;
  if (isEmpty) return <>{empty ?? <EmptyState title="Nothing to show" />}</>;
  return <>{children}</>;
}

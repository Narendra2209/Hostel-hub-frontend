/**
 * Pagination control for the list screens.
 * Server-driven: it renders whatever `PaginationMeta` the API returned.
 */
import type { PaginationMeta } from '@hostel/shared';

export interface PaginationProps {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Noun for the summary line, e.g. "residents". */
  itemLabel?: string;
  pageSizeOptions?: number[];
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  for (let offset = 1; offset <= 1; offset++) {
    if (current - offset > 1) pages.add(current - offset);
    if (current + offset < total) pages.add(current + offset);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push('gap');
    out.push(page);
    previous = page;
  }
  return out;
}

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
  pageSizeOptions = [20, 50, 100],
}: PaginationProps): JSX.Element | null {
  if (!meta || meta.total === 0) return null;

  const { page, pageSize, total, totalPages } = meta;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  // A single page of results needs a count, but not a pager.
  const showPager = totalPages > 1;

  return (
    <div className="pager">
      <span className="hint">
        Showing <span className="num">{first}</span>–<span className="num">{last}</span> of{' '}
        <span className="num">{total}</span> {itemLabel}
      </span>
      <div className="spacer" />

      {onPageSizeChange ? (
        <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Per page
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            style={{ width: 'auto', padding: '4px 6px' }}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showPager ? (
        <nav className="pages" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ←
          </button>
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === 'gap' ? (
              <span className="gap" key={`gap-${index}`}>
                …
              </span>
            ) : (
              <button
                type="button"
                key={entry}
                className={entry === page ? 'on' : undefined}
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`Page ${entry}`}
              >
                {entry}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            →
          </button>
        </nav>
      ) : null}
    </div>
  );
}

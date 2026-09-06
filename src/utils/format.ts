/**
 * Presentation-only helpers.
 *
 * Nothing here computes a financial figure - the backend does that. These
 * functions turn values the API already returned into the strings the reference
 * UI displayed.
 */
import { formatMonthLabel, formatOrdinalDay, type MonthKey } from '@hostel/shared';

export const EM_DASH = '—';

/** "3 residents" / "1 resident" */
export const pluralise = (count: number, singular: string, plural?: string): string =>
  `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

/** The reference's `entr(y|ies)` wording. */
export const entries = (count: number): string => `${count} ${count === 1 ? 'entry' : 'entries'}`;

/** Blank values render as an em dash, exactly as the original tables did. */
export const orDash = (value: string | null | undefined): string =>
  value && value.trim().length > 0 ? value : EM_DASH;

/** "5th", "21st" - the due-day column. */
export const dueDayLabel = (day: number): string => formatOrdinalDay(day);

/** Initials for the profile photo placeholder: first letters of two name parts. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

/** Inline style for a figure that should be red when money is owed. */
export const owedStyle = (amount: number) =>
  amount > 0 ? { color: 'var(--late)', fontWeight: 600 } : undefined;

/** Inline style for a net figure: green when positive, red when negative. */
export const netStyle = (amount: number) => ({
  color: amount >= 0 ? 'var(--ok)' : 'var(--late)',
  fontWeight: 600,
});

export const monthLabel = (month: MonthKey): string => formatMonthLabel(month);

/** Percentage of a bar's width, floored at a visible minimum like the original. */
export const barWidth = (value: number, max: number, minPercent = 4): string => {
  if (max <= 0) return `${minPercent}%`;
  return `${Math.max(minPercent, (value / max) * 100)}%`;
};

/** Save a downloaded export blob to disk. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Read a File's size and type for the presign request. */
export interface FileMeta {
  contentType: string;
  contentLength: number;
  fileName: string;
}

export const fileMeta = (file: File): FileMeta => ({
  contentType: file.type,
  contentLength: file.size,
  fileName: file.name,
});

/**
 * The pager is server-driven: it renders whatever `PaginationMeta` the API
 * returned and asks the caller to fetch a page number. It must never invent a
 * page that does not exist, and it must disappear when there is nothing to page
 * through.
 */
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import type { PaginationMeta } from '@hostel/shared';
import { renderWithProviders } from '../../test/utils';
import { Pagination } from './Pagination';

const meta = (over: Partial<PaginationMeta> = {}): PaginationMeta => ({
  page: 1,
  pageSize: 20,
  total: 105,
  totalPages: 6,
  ...over,
});

const summaryText = (container: HTMLElement): string =>
  container.querySelector('.pager .hint')?.textContent ?? '';

const pager = (): HTMLElement => screen.getByRole('navigation', { name: 'Pagination' });

describe('Pagination', () => {
  it('summarises the slice of the result set on show', () => {
    const { container } = renderWithProviders(
      <Pagination meta={meta({ page: 3 })} onPageChange={vi.fn()} itemLabel="residents" />,
    );

    expect(summaryText(container)).toBe('Showing 41–60 of 105 residents');
  });

  it('stops the summary at the total on a short last page', () => {
    const { container } = renderWithProviders(
      <Pagination meta={meta({ page: 6 })} onPageChange={vi.fn()} itemLabel="residents" />,
    );

    expect(summaryText(container)).toBe('Showing 101–105 of 105 residents');
  });

  it('falls back to a neutral noun when no label is given', () => {
    const { container } = renderWithProviders(
      <Pagination meta={meta({ page: 1, total: 3, totalPages: 1 })} onPageChange={vi.fn()} />,
    );

    expect(summaryText(container)).toBe('Showing 1–3 of 3 records');
  });

  it('disables previous on the first page', () => {
    renderWithProviders(<Pagination meta={meta({ page: 1 })} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('disables next on the last page', () => {
    renderWithProviders(<Pagination meta={meta({ page: 6 })} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('asks for the next and previous page numbers', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderWithProviders(<Pagination meta={meta({ page: 3 })} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it('asks for the page a numbered button names', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderWithProviders(<Pagination meta={meta({ page: 3 })} onPageChange={onPageChange} />);

    await user.click(within(pager()).getByRole('button', { name: 'Page 6' }));

    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(6);
  });

  it('marks the current page for assistive technology', () => {
    renderWithProviders(<Pagination meta={meta({ page: 3 })} onPageChange={vi.fn()} />);

    const current = within(pager()).getByRole('button', { name: 'Page 3' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('on');
    expect(within(pager()).getByRole('button', { name: 'Page 2' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('windows a long page list around the current page', () => {
    renderWithProviders(
      <Pagination meta={meta({ page: 10, total: 400, totalPages: 20 })} onPageChange={vi.fn()} />,
    );

    const labels = within(pager())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));

    expect(labels).toEqual([
      'Previous page',
      'Page 1',
      'Page 9',
      'Page 10',
      'Page 11',
      'Page 20',
      'Next page',
    ]);
    expect(within(pager()).getAllByText('…')).toHaveLength(2);
  });

  it('renders nothing at all when there are no records', () => {
    const { container } = renderWithProviders(
      <Pagination meta={meta({ page: 1, total: 0, totalPages: 0 })} onPageChange={vi.fn()} />,
    );

    expect(container.querySelector('.pager')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('renders nothing while the meta has not arrived', () => {
    const { container } = renderWithProviders(
      <Pagination meta={undefined} onPageChange={vi.fn()} />,
    );

    expect(container.querySelector('.pager')).toBeNull();
  });

  it('keeps the count but drops the pager for a single page of results', () => {
    const { container } = renderWithProviders(
      <Pagination
        meta={meta({ page: 1, total: 12, totalPages: 1 })}
        onPageChange={vi.fn()}
        itemLabel="expenses"
      />,
    );

    expect(summaryText(container)).toBe('Showing 1–12 of 12 expenses');
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('offers a page-size selector only when the caller can handle one', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    const { rerender } = renderWithProviders(
      <Pagination meta={meta()} onPageChange={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument();

    rerender(
      <Pagination meta={meta()} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />,
    );
    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');

    expect(onPageSizeChange).toHaveBeenCalledExactlyOnceWith(50);
  });
});

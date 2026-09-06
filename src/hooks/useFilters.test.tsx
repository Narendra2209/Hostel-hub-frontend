/**
 * The month / building / year filters live in the URL so a view can be shared
 * and survives a refresh. These tests read the query string back after every
 * change, because "the filter moved" and "the URL says so" have to stay the
 * same statement.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { ALL_BUILDINGS, currentMonthKey } from '@hostel/shared';
import { createWrapper } from '../test/utils';
import { useFilters, type Filters } from './useFilters';

interface Probe {
  filters: Filters;
  search: string;
}

/** The hook plus the address bar it writes to. */
function useProbe(): Probe {
  return { filters: useFilters(), search: useLocation().search };
}

function setup(entry: string) {
  return renderHook(useProbe, { wrapper: createWrapper({ initialEntries: [entry] }) });
}

/** The query string as a plain object, order-independent. */
const params = (search: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(search));

describe('useFilters defaults', () => {
  it('falls back to the current month in the hostel timezone', () => {
    const { result } = setup('/');

    expect(result.current.filters.month).toBe(currentMonthKey());
    expect(result.current.filters.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('reads a month out of the query string', () => {
    const { result } = setup('/fees?month=2026-08');

    expect(result.current.filters.month).toBe('2026-08');
  });

  it('ignores a month that is not a real month key', () => {
    expect(setup('/?month=2026-13').result.current.filters.month).toBe(currentMonthKey());
    expect(setup('/?month=august').result.current.filters.month).toBe(currentMonthKey());
  });

  it('defaults the building to every building', () => {
    const { result } = setup('/');

    expect(result.current.filters.buildingId).toBe(ALL_BUILDINGS);
    expect(result.current.filters.buildingId).toBe('all');
  });

  it('reads a building out of the query string', () => {
    const { result } = setup('/residents?building=bld-7');

    expect(result.current.filters.buildingId).toBe('bld-7');
  });

  it("defaults the year to the month's year", () => {
    const { result } = setup('/?month=2024-02');

    expect(result.current.filters.year).toBe(2024);
  });

  it('prefers an explicitly pinned year', () => {
    const { result } = setup('/?month=2024-02&year=2022');

    expect(result.current.filters.year).toBe(2022);
  });

  it('ignores a year outside the supported range or shaped wrongly', () => {
    expect(setup('/?month=2026-08&year=1999').result.current.filters.year).toBe(2026);
    expect(setup('/?month=2026-08&year=2201').result.current.filters.year).toBe(2026);
    expect(setup('/?month=2026-08&year=last').result.current.filters.year).toBe(2026);
  });

  it('exposes a ready-made scope for the month/building queries', () => {
    const { result } = setup('/?month=2026-08&building=bld-7');

    expect(result.current.filters.scope).toEqual({ month: '2026-08', buildingId: 'bld-7' });
  });
});

describe('useFilters writes to the URL', () => {
  it('setMonth stores the month and rebases a pinned year', () => {
    const { result } = setup('/fees?month=2026-08&year=2024&q=anita');

    act(() => result.current.filters.setMonth('2026-11'));

    expect(params(result.current.search)).toEqual({ month: '2026-11', q: 'anita' });
    expect(result.current.filters.month).toBe('2026-11');
    expect(result.current.filters.year).toBe(2026);
  });

  it('setBuilding stores the building', () => {
    const { result } = setup('/?month=2026-08');

    act(() => result.current.filters.setBuilding('bld-3'));

    expect(params(result.current.search)).toEqual({ month: '2026-08', building: 'bld-3' });
    expect(result.current.filters.buildingId).toBe('bld-3');
  });

  it("setBuilding('all') removes the parameter instead of writing a sentinel", () => {
    const { result } = setup('/?month=2026-08&building=bld-3');

    act(() => result.current.filters.setBuilding(ALL_BUILDINGS));

    expect(result.current.search).not.toContain('building');
    expect(params(result.current.search)).toEqual({ month: '2026-08' });
    expect(result.current.filters.buildingId).toBe(ALL_BUILDINGS);
  });

  it('leaves the other filters alone when one changes', () => {
    const { result } = setup('/?month=2026-08&building=bld-3');

    act(() => result.current.filters.setMonth('2026-09'));

    expect(params(result.current.search)).toEqual({ month: '2026-09', building: 'bld-3' });
  });

  it('setYear pins a year and stepYear walks it', () => {
    const { result } = setup('/?month=2026-08');

    act(() => result.current.filters.setYear(2023));
    expect(params(result.current.search)).toEqual({ month: '2026-08', year: '2023' });
    expect(result.current.filters.year).toBe(2023);

    act(() => result.current.filters.stepYear(1));
    expect(result.current.filters.year).toBe(2024);

    act(() => result.current.filters.stepYear(-2));
    expect(result.current.filters.year).toBe(2022);
  });

  it('keeps the same callbacks between renders so effects do not loop', () => {
    const { result, rerender } = setup('/?month=2026-08');
    const first = result.current.filters;

    rerender();

    expect(result.current.filters.setMonth).toBe(first.setMonth);
    expect(result.current.filters.setBuilding).toBe(first.setBuilding);
  });
});

/**
 * The shared harness for the component tests.
 *
 * Every screen in this application sits inside four providers - the router (the
 * global filters live in the URL), React Query, toasts and the confirm dialog -
 * so a component test that renders any of them needs the same frame. Each test
 * gets a brand-new QueryClient with retries switched off, so one test's cache
 * and one test's rejected promise can never leak into the next.
 */
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { vi, type MockedFunction } from 'vitest';
import { ConfirmProvider } from '../components/common/ConfirmProvider';
import { ToastProvider } from '../components/common/ToastProvider';

/* ------------------------------------------------------------------ *
 * Query client
 * ------------------------------------------------------------------ */

/**
 * A client that behaves predictably under test: a failed query fails once and
 * stays failed, nothing is cached beyond the test, and nothing refetches
 * because jsdom happened to fire a focus event.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
}

/* ------------------------------------------------------------------ *
 * Seeding the URL
 * ------------------------------------------------------------------ */

export type QueryParamValue = string | number | boolean | null | undefined;

/**
 * Build an initial entry for the memory router:
 * `withSearchParams('/fees', { month: '2026-08' })` gives `/fees?month=2026-08`.
 * Null, undefined and empty values are dropped, exactly as `useFilters` does.
 */
export function withSearchParams(
  pathname: string,
  params: Record<string, QueryParamValue> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export interface ProviderOptions {
  /** Full control over the router's history stack. */
  initialEntries?: string[];
  /** Convenience: the single initial entry's pathname. Defaults to `/`. */
  path?: string;
  /** Convenience: the single initial entry's query string. */
  searchParams?: Record<string, QueryParamValue>;
  queryClient?: QueryClient;
}

function initialEntriesFor(options: ProviderOptions): string[] {
  if (options.initialEntries) return options.initialEntries;
  return [withSearchParams(options.path ?? '/', options.searchParams)];
}

/** The provider stack on its own, for `renderHook`'s `wrapper` option. */
export function createWrapper(
  options: ProviderOptions = {},
): (props: { children: ReactNode }) => ReactElement {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const entries = initialEntriesFor(options);

  return function Providers({ children }: { children: ReactNode }): ReactElement {
    return (
      <MemoryRouter initialEntries={entries}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };
}

export interface RenderWithProvidersOptions
  extends ProviderOptions,
    Omit<RenderOptions, 'wrapper' | 'queries'> {}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

/** `render()` inside MemoryRouter + QueryClientProvider + toasts + confirm. */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { initialEntries, path, searchParams, queryClient: given, ...renderOptions } = options;
  const queryClient = given ?? createTestQueryClient();
  const Wrapper = createWrapper({ initialEntries, path, searchParams, queryClient });
  const view: RenderResult = render(ui, { wrapper: Wrapper, ...renderOptions });

  return { ...view, queryClient };
}

/* ------------------------------------------------------------------ *
 * API mocking
 * ------------------------------------------------------------------ */

type ResourcesModule = typeof import('../api/resources');

/**
 * The endpoints the component tests exercise, typed against the real module so
 * a signature change breaks the mock rather than the test's expectations.
 * Every resource a rendered screen imports has to be present here, otherwise
 * the mocked module has no such export and the import throws.
 */
export interface MockApi {
  dashboardApi: {
    get: MockedFunction<ResourcesModule['dashboardApi']['get']>;
  };
  settingsApi: {
    get: MockedFunction<ResourcesModule['settingsApi']['get']>;
    update: MockedFunction<ResourcesModule['settingsApi']['update']>;
  };
  buildingsApi: {
    list: MockedFunction<ResourcesModule['buildingsApi']['list']>;
    get: MockedFunction<ResourcesModule['buildingsApi']['get']>;
    create: MockedFunction<ResourcesModule['buildingsApi']['create']>;
    update: MockedFunction<ResourcesModule['buildingsApi']['update']>;
    remove: MockedFunction<ResourcesModule['buildingsApi']['remove']>;
  };
  categoriesApi: {
    list: MockedFunction<ResourcesModule['categoriesApi']['list']>;
    create: MockedFunction<ResourcesModule['categoriesApi']['create']>;
    update: MockedFunction<ResourcesModule['categoriesApi']['update']>;
    remove: MockedFunction<ResourcesModule['categoriesApi']['remove']>;
  };
}

/**
 * Use from inside a `vi.mock` factory:
 *
 *   vi.mock('../api/resources', async () => {
 *     const { createMockApi } = await import('../test/utils');
 *     return createMockApi();
 *   });
 *
 * The test then imports the resource as usual and drives it with `vi.mocked`.
 */
export function createMockApi(): MockApi {
  return {
    dashboardApi: {
      get: vi.fn<ResourcesModule['dashboardApi']['get']>(),
    },
    settingsApi: {
      get: vi.fn<ResourcesModule['settingsApi']['get']>(),
      update: vi.fn<ResourcesModule['settingsApi']['update']>(),
    },
    buildingsApi: {
      list: vi.fn<ResourcesModule['buildingsApi']['list']>(),
      get: vi.fn<ResourcesModule['buildingsApi']['get']>(),
      create: vi.fn<ResourcesModule['buildingsApi']['create']>(),
      update: vi.fn<ResourcesModule['buildingsApi']['update']>(),
      remove: vi.fn<ResourcesModule['buildingsApi']['remove']>(),
    },
    categoriesApi: {
      list: vi.fn<ResourcesModule['categoriesApi']['list']>(),
      create: vi.fn<ResourcesModule['categoriesApi']['create']>(),
      update: vi.fn<ResourcesModule['categoriesApi']['update']>(),
      remove: vi.fn<ResourcesModule['categoriesApi']['remove']>(),
    },
  };
}

/* ------------------------------------------------------------------ *
 * DOM helpers
 * ------------------------------------------------------------------ */

/** Every non-blank text node under `root`, trimmed - what a reader actually sees. */
export function textNodesIn(root: Node): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    if (text.length > 0) out.push(text);
  }
  return out;
}

/**
 * A promise resolved by hand, so a test can inspect the DOM while a request is
 * still in flight.
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * The application frame: dark rail on the left, sticky top bar, scrolling
 * content well. Matches the reference layout exactly (`.app` > `.rail` + `main`).
 */
import { Suspense, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { LoadingState } from '../common/states';

export function AppShell(): JSX.Element {
  return (
    <div className="app">
      <Sidebar />
      <main>
        <Suspense fallback={<LoadingState label="Loading the page…" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

/** The padded content well every page renders inside. */
export function PageBody({ children }: { children: ReactNode }): JSX.Element {
  return <div className="wrap">{children}</div>;
}

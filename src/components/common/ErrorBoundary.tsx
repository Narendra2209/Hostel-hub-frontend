/**
 * Last-resort boundary so a render bug shows a readable page rather than a
 * blank screen. Nothing here reports to a third party.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="card">
            <div className="card-h">
              <h2>Something went wrong</h2>
            </div>
            <div className="modal-body">
              The page could not be displayed. Your data is safe in the hostel database - reloading
              usually fixes this.
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => window.location.reload()}>
                Reload the page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

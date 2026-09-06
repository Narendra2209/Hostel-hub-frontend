/**
 * The `.card` / `.card-h` shell used by every screen in the reference UI.
 */
import type { CSSProperties, ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  /** Right-hand side of the header, after the flexible spacer. */
  actions?: ReactNode;
  /** Small muted text placed before the actions. */
  hint?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Card({ title, actions, hint, children, style, className }: CardProps): JSX.Element {
  const hasHeader = title !== undefined || actions !== undefined || hint !== undefined;
  return (
    <div className={`card${className ? ` ${className}` : ''}`} style={style}>
      {hasHeader ? (
        <div className="card-h">
          {title !== undefined ? <h2>{title}</h2> : null}
          <div className="spacer" />
          {hint !== undefined ? <span className="hint">{hint}</span> : null}
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Horizontally scrollable table wrapper - keeps wide tables off the page axis. */
export function TableScroll({ children }: { children: ReactNode }): JSX.Element {
  return <div className="tablescroll">{children}</div>;
}

export interface StatCardProps {
  eyebrow: ReactNode;
  value: ReactNode;
  foot?: ReactNode;
  tone?: 'default' | 'ok' | 'late';
  valueStyle?: CSSProperties;
}

/** The `.stat` tile: accent bar, eyebrow, big monospace number, footnote. */
export function StatCard({
  eyebrow,
  value,
  foot,
  tone = 'default',
  valueStyle,
}: StatCardProps): JSX.Element {
  const toneClass = tone === 'ok' ? ' ok-accent' : tone === 'late' ? ' late-accent' : '';
  return (
    <div className={`stat${toneClass}`}>
      <div className="bar" />
      <div className="eyebrow">{eyebrow}</div>
      <b style={valueStyle}>{value}</b>
      {foot !== undefined ? <div className="foot">{foot}</div> : null}
    </div>
  );
}

export function StatGrid({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div className="stats" style={style}>
      {children}
    </div>
  );
}

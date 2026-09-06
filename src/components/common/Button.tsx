/**
 * The reference UI's `.btn` in component form.
 * `loading` disables the button and shows a spinner, so no screen has to
 * reinvent "disabled while saving".
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: '',
  ghost: ' ghost',
  danger: ' danger',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const classes = `btn${VARIANT_CLASS[variant]}${size === 'sm' ? ' sm' : ''}${
    className ? ` ${className}` : ''
  }`;

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" /> <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

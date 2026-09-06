/**
 * The reference UI's `.field` label wrapper, with validation messaging.
 *
 * Client validation (React Hook Form + the shared Zod schemas) is a courtesy;
 * the server validates every request again with the same schemas.
 */
import { useId, type ReactNode } from 'react';

export interface FormFieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Receives the id and aria props to spread onto the control. */
  children: (props: {
    id: string;
    'aria-invalid': boolean | undefined;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

export function FormField({ label, error, hint, children }: FormFieldProps): JSX.Element {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {error ? (
        <span className="err" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/** Banner for an error that belongs to the form as a whole, not one field. */
export function FormError({ message }: { message?: string | null }): JSX.Element | null {
  if (!message) return null;
  return (
    <div className="form-error" role="alert">
      {message}
    </div>
  );
}

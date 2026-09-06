/**
 * Toast notifications - the reference UI's `toast()` function, made stackable.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'default' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  leaving?: boolean;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 2600;
const LEAVE_MS = 200;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const push = useCallback((message: string, tone: ToastTone = 'default') => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);

    timers.current.push(
      window.setTimeout(() => {
        setToasts((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        timers.current.push(
          window.setTimeout(() => {
            setToasts((current) => current.filter((t) => t.id !== id));
          }, LEAVE_MS),
        );
      }, VISIBLE_MS),
    );
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (message: string) => push(message, 'default'),
      error: (message: string) => push(message, 'error'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-item${t.tone === 'error' ? ' error' : ''}${t.leaving ? ' leaving' : ''}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

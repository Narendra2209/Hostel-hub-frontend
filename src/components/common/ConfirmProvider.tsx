/**
 * A promise-based replacement for `window.confirm`.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Remove resident?', message: '…', tone: 'danger' })) { … }
 *
 * The reference application used native confirm dialogs for every destructive
 * action; production needs something styled, accessible and awaitable.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }): JSX.Element {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    // A second request while one is open resolves the first as cancelled,
    // rather than orphaning its promise forever.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={options !== null}
        title={options?.title ?? ''}
        onClose={() => settle(false)}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => settle(false)}>
              {options?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={options?.tone === 'danger' ? 'btn danger' : 'btn'}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        {options?.message}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return context;
}

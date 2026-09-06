/**
 * Full-screen image viewer, matching the reference UI's `.lightbox`.
 * Escape or a click anywhere closes it.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface LightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function Lightbox({ src, alt = '', onClose }: LightboxProps): JSX.Element | null {
  useEffect(() => {
    if (!src) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      className="lightbox on"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image viewer'}
    >
      <img src={src} alt={alt} />
    </div>,
    document.body,
  );
}

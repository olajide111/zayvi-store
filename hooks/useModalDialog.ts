'use client';

import { useEffect, useRef } from 'react';

/** Keep keyboard interaction inside the open dialog and restore its trigger. */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
    )).filter(element => element.getClientRects().length > 0);
    const focusFirst = () => (focusable()[0] || dialog).focus();

    document.body.style.overflow = 'hidden';
    focusFirst();
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function containFocus(event: FocusEvent) {
      if (!dialog.contains(event.target as Node)) focusFirst();
    }
    dialog.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', containFocus);
    return () => {
      dialog.removeEventListener('keydown', handleKey);
      document.removeEventListener('focusin', containFocus);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  return ref;
}

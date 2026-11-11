'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // local edits confirm here; without it, the button submits its form (with its formAction, if it has one)
  onConfirm?: () => void;
};

// A delete button that asks first, in the back office's own 8-bit style. With `onConfirm` it runs that callback;
// without it, it submits the surrounding form through this button, so a server action in `formAction` still runs.
export default function ConfirmButton({ title = '確認刪除', message, confirmLabel = '刪除', cancelLabel = '取消', onConfirm, children, className, disabled, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key !== 'Tab') return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  const close = () => setOpen(false);
  const confirm = () => {
    setOpen(false);
    if (onConfirm) { onConfirm(); return; }
    const form = trigger.current?.form;
    if (form && trigger.current) form.requestSubmit(trigger.current);
  };

  return (
    <>
      <button ref={trigger} type={onConfirm ? 'button' : 'submit'} className={className} disabled={disabled}
        aria-haspopup="dialog" onClick={e => { e.preventDefault(); setOpen(true); }} {...rest}>
        {children}
      </button>
      {open && createPortal(
        <div className="confirm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
          <div ref={dialog} className="confirm" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}>
            <h2 id={`${id}-title`}>{title}</h2>
            <p id={`${id}-message`}>{message}</p>
            <div className="confirm-actions">
              <button ref={cancel} type="button" onClick={close}>{cancelLabel}</button>
              <button type="button" className="primary" onClick={confirm}>{confirmLabel}</button>
            </div>
          </div>
        </div>,
        document.querySelector('.admin') ?? document.body,
      )}
    </>
  );
}

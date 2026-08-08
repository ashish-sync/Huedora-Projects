import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal shell: portal, Escape, body scroll lock, focus trap, aria-modal.
 */
export default function ModalShell({
  open = true,
  onClose,
  title,
  titleId: titleIdProp,
  labelledBy,
  describedBy,
  children,
  overlayClassName = 'modal-overlay',
  panelClassName = 'modal-card',
  closeOnOverlayClick = true,
  initialFocusRef,
}) {
  const panelRef = useRef(null);
  const lastFocusRef = useRef(null);
  const reactId = useId();
  const titleId = titleIdProp || (title ? `modal-title-${reactId}` : undefined);
  const labelAttrs = labelledBy
    ? { 'aria-labelledby': labelledBy }
    : titleId
      ? { 'aria-labelledby': titleId }
      : title
        ? { 'aria-label': title }
        : {};

  useEffect(() => {
    if (!open) return undefined;

    lastFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusTarget =
      initialFocusRef?.current ||
      panel?.querySelector?.(FOCUSABLE) ||
      panel;
    window.requestAnimationFrame(() => {
      try {
        focusTarget?.focus?.({ preventScroll: true });
      } catch {
        /* ignore */
      }
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
      if (!nodes.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const prev = lastFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        try {
          prev.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  const node = (
    <div
      className={overlayClassName}
      role="presentation"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...labelAttrs}
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <h2 id={titleId} className="modal-shell-title">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const LEAVE_MESSAGE = 'Import is in progress. Please wait until it finishes.';

/**
 * Blocks tab close/refresh and locks page scroll while an import runs.
 * Full-screen overlay (portal) blocks in-app clicks / skip actions.
 */
export function useImportInProgressLock(active) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = LEAVE_MESSAGE;
      return LEAVE_MESSAGE;
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [active]);
}

/**
 * Full-screen blocker shown while a file upload/import is running.
 * Renders via portal so module tabs and app chrome cannot be clicked through.
 */
export default function ImportInProgressGuard({
  active = false,
  message = 'Import in Progress',
  detail = 'Please wait — do not leave or skip this step until the import finishes.',
}) {
  useImportInProgressLock(active);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="import-in-progress-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="assertive"
      aria-label={message}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="import-in-progress-card">
        <div className="import-in-progress-spinner" aria-hidden="true" />
        <p className="import-in-progress-title">{message}</p>
        {detail ? <p className="import-in-progress-detail">{detail}</p> : null}
      </div>
    </div>,
    document.body,
  );
}

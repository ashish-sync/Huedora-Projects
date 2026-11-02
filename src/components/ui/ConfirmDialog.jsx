import ModalShell from './ModalShell.jsx';
import Button from './Button.jsx';

/**
 * Standard enterprise confirmation dialog.
 * Replaces window.confirm with a theme-aware accessible dialog.
 */
export default function ConfirmDialog({
  open = false,
  title = 'Please Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  children,
}) {
  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={loading ? undefined : onCancel}
      title={title}
      overlayClassName="modal-overlay"
      panelClassName="confirm-dialog modal-card--sm"
    >
      <div className="confirm-body">
        {message ? <p className="modal-message">{message}</p> : null}
        {children}
      </div>

      <div className="confirm-actions modal-actions">
        <Button
          variant="secondary"
          disabled={loading}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={confirmVariant}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}


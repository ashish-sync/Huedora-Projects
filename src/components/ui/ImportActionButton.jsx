import { useEffect, useRef, useState } from 'react';
import { ACTION } from '../../shared/labels.js';
import { IMPORT_ACCEPT_ATTR } from '../../shared/importFilePolicy.js';

/**
 * One Import button. When a sample exists, Sample format lives in the menu
 * so toolbars do not need a second button.
 */
export default function ImportActionButton({
  canImport = false,
  hasSample = false,
  onImport,
  onSample,
  importBusy = false,
  sampleBusy = false,
  disabled = false,
  compact = false,
  accept = IMPORT_ACCEPT_ATTR,
  title,
  className = '',
}) {
  const fileRef = useRef(null);
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const busy = importBusy || sampleBusy;
  const btnClass = `btn secondary${compact ? ' btn-compact' : ''}${className ? ` ${className}` : ''}`;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pickFile = () => fileRef.current?.click();

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (file) onImport?.(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!canImport && !hasSample) return null;

  const fileInput = canImport ? (
    <input
      ref={fileRef}
      type="file"
      accept={accept}
      hidden
      onChange={handleFile}
    />
  ) : null;

  if (!canImport) {
    return (
      <button className={btnClass} type="button" disabled={disabled || busy} onClick={onSample}>
        {sampleBusy ? ACTION.DOWNLOADING : ACTION.SAMPLE_FORMAT}
      </button>
    );
  }

  if (!hasSample) {
    return (
      <>
        {fileInput}
        <button
          className={btnClass}
          type="button"
          disabled={disabled || busy}
          title={title}
          onClick={pickFile}
        >
          {importBusy ? ACTION.IMPORTING : ACTION.IMPORT}
        </button>
      </>
    );
  }

  return (
    <div className="import-action" ref={rootRef}>
      {fileInput}
      <button
        className={btnClass}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || busy}
        title={title}
        onClick={() => setOpen((value) => !value)}
      >
        {importBusy ? ACTION.IMPORTING : sampleBusy ? ACTION.DOWNLOADING : ACTION.IMPORT}
        <span className="import-action__caret" aria-hidden="true" />
      </button>
      {open ? (
        <div className="import-action__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSample?.();
            }}
          >
            {ACTION.SAMPLE_FORMAT}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              pickFile();
            }}
          >
            {ACTION.IMPORT_FILE}
          </button>
        </div>
      ) : null}
    </div>
  );
}

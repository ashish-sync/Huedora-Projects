import { useState } from 'react';

export function Field({ label, hint, children, className = '', required }) {
  return (
    <div className={`doc-field ${className}`.trim()}>
      <label className="doc-field-label">
        {label}
        {required ? <span className="doc-field-req">*</span> : null}
      </label>
      {children}
      {hint ? <p className="doc-field-hint">{hint}</p> : null}
    </div>
  );
}

export function FormSection({
  id,
  title,
  description,
  defaultOpen = true,
  children,
  badge,
  step,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionId = id ? `doc-section-${id}` : undefined;

  return (
    <section id={sectionId} className={`doc-section${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="doc-section-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {step ? <span className="doc-section-step">{step}</span> : null}
        <div className="doc-section-head-text">
          <span className="doc-section-title">{title}</span>
          {description ? <span className="doc-section-desc">{description}</span> : null}
        </div>
        {badge ? <span className="doc-section-badge">{badge}</span> : null}
        <span className="doc-section-chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d={open ? 'M3 5l3 3 3-3' : 'M5 3l3 3-3 3'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="doc-section-body">{children}</div> : null}
    </section>
  );
}

export function LineCard({ title, onRemove, children, footer }) {
  return (
    <div className="doc-line-card">
      <div className="doc-line-card-head">
        <strong>{title}</strong>
        {onRemove ? (
          <button type="button" className="doc-line-remove" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>
      <div className="doc-line-card-body">{children}</div>
      {footer ? <div className="doc-line-card-foot">{footer}</div> : null}
    </div>
  );
}

export function TotalsStrip({ rows, grandLabel = 'Grand Total', grandValue }) {
  return (
    <div className="doc-totals-strip">
      <div className="doc-totals-strip-head">Summary</div>
      {rows.map(([label, value]) => (
        <div key={label} className="doc-totals-row">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <div className="doc-totals-grand">
        <span>{grandLabel}</span>
        <strong>{grandValue}</strong>
      </div>
    </div>
  );
}

export function FileDrop({ label, accept = 'image/*', onFile, previewUrl, className = '' }) {
  return (
    <div className={`doc-file-drop ${className}`.trim()}>
      <label className={`doc-file-drop-label${previewUrl ? ' has-preview' : ''}`}>
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="" className="doc-file-drop-preview" />
            <span className="doc-file-drop-replace-hint">Click to replace</span>
          </>
        ) : (
          <>
            <span className="doc-file-drop-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 13V4M7 7l3-3 3 3M4 14v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="doc-file-drop-placeholder">{label}</span>
            <span className="doc-file-drop-hint">PNG, JPG up to 2 MB</span>
          </>
        )}
        <input
          type="file"
          accept={accept}
          className="doc-file-drop-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
    </div>
  );
}

export function readFileAsDataUrl(file, onLoad) {
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result);
  reader.readAsDataURL(file);
}

export function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

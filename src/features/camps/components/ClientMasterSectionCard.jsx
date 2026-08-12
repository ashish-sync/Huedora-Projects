/**
 * Section card for Client Master — one editable section at a time.
 */
export function ClientMasterSectionCard({
  title,
  description = '',
  step,
  isEditing = false,
  editLocked = false,
  saving = false,
  summary = [],
  onEdit,
  onSave,
  onCancel,
  children,
}) {
  return (
    <section
      className={`client-master-section${isEditing ? ' is-editing' : ''}${editLocked ? ' is-locked' : ''}`}
      aria-labelledby={`client-master-section-${step}`}
    >
      <header className="client-master-section-head">
        <div className="client-master-section-head-text">
          <span className="client-master-section-step">{step}</span>
          <div>
            <h3 className="client-master-section-title" id={`client-master-section-${step}`}>
              {title}
            </h3>
            {description ? (
              <p className="meta-text client-master-section-desc">{description}</p>
            ) : null}
          </div>
        </div>
        {!isEditing ? (
          <button
            type="button"
            className="btn secondary btn-sm client-master-section-edit-btn"
            disabled={editLocked || saving}
            onClick={onEdit}
          >
            Edit
          </button>
        ) : (
          <div className="client-master-section-actions">
            <button
              type="button"
              className="btn secondary btn-sm"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={onSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </header>

      {!isEditing ? (
        <dl className="client-master-section-summary">
          {summary.map(({ label, value, span = 1 }) => (
            <div
              key={label}
              className={`client-master-section-summary-row${span > 1 ? ` span-${span}` : ''}`}
            >
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="client-master-section-body">{children}</div>
      )}
    </section>
  );
}

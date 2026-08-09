/**
 * Compact alert for the HCW same-day 1h30 gap rule.
 */
export function HcwAssignmentGapAlert({ conflict }) {
  if (!conflict) return null;

  const meta = [
    conflict.campId && conflict.campId !== '—' ? `Camp ${conflict.campId}` : null,
    conflict.timeRangeLabel || null,
    conflict.pincode && conflict.pincode !== '—' ? `PIN ${conflict.pincode}` : null,
  ].filter(Boolean);

  return (
    <div className="hcw-gap-alert" role="alert">
      <div className="hcw-gap-alert-row">
        <span className="hcw-gap-alert-badge" aria-hidden="true">!</span>
        <div className="hcw-gap-alert-body">
          <div className="hcw-gap-alert-title-row">
            <strong>{conflict.title || 'HCW schedule conflict'}</strong>
            {conflict.earliestStartLabel ? (
              <span className="hcw-gap-alert-next-chip">
                Earliest start <b>{conflict.earliestStartLabel}</b>
              </span>
            ) : null}
          </div>
          <p className="hcw-gap-alert-summary">
            Needs 1h 30m after the conflicting camp ends.
            {meta.length ? ` ${meta.join(' · ')}` : ''}
          </p>
          {!meta.length && (conflict.summary || conflict.message) ? (
            <p className="hcw-gap-alert-summary">{conflict.summary || conflict.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

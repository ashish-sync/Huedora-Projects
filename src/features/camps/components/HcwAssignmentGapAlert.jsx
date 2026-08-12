/**
 * Compact alert for the HCW same-day 1h30 gap rule.
 */
export function HcwAssignmentGapAlert({ conflict }) {
  if (!conflict) return null;

  return (
    <div className="hcw-gap-alert" role="alert">
      <div className="hcw-gap-alert-row">
        <span className="hcw-gap-alert-badge" aria-hidden="true">!</span>
        <div className="hcw-gap-alert-body">
          <p className="hcw-gap-alert-summary">{conflict.message}</p>
        </div>
      </div>
    </div>
  );
}

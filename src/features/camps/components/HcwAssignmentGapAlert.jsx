/**
 * Soft warning for the HCW same-day 30-minute gap rule.
 * Users may proceed; assignment then needs Reporting Manager approval.
 */
export function HcwAssignmentGapAlert({
  conflict,
  onProceed,
  onCancel,
  proceeding = false,
}) {
  if (!conflict) return null;

  return (
    <div className="hcw-gap-alert" role="alert">
      <div className="hcw-gap-alert-row">
        <span className="hcw-gap-alert-badge" aria-hidden="true">!</span>
        <div className="hcw-gap-alert-body">
          <p className="hcw-gap-alert-summary">{conflict.message}</p>
          {conflict.approvalMessage || onProceed ? (
            <p className="hcw-gap-alert-approval">
              {conflict.approvalMessage
                || 'If you proceed, this assignment requires approval from your Reporting Manager.'}
            </p>
          ) : null}
          {onProceed ? (
            <div className="hcw-gap-alert-actions">
              {onCancel ? (
                <button
                  type="button"
                  className="btn secondary btn-sm"
                  disabled={proceeding}
                  onClick={onCancel}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-sm"
                disabled={proceeding}
                onClick={onProceed}
              >
                {proceeding ? 'Saving…' : 'Proceed anyway'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

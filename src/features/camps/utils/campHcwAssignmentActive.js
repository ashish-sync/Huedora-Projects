const TERMINAL_CAMP_STATUSES = ['cancelled', 'rejected'];
const TERMINAL_EXECUTION_STATUSES = ['Cancelled', 'Refused', 'Rejected'];

function trimStr(value) {
  return value == null ? '' : String(value).trim();
}

/** True when this camp still occupies the HCW for schedule / gap checks. */
export function isActiveHcwAssignedCamp(camp = {}) {
  if (TERMINAL_CAMP_STATUSES.includes(trimStr(camp.status))) return false;
  if (TERMINAL_EXECUTION_STATUSES.includes(trimStr(camp.executionStatus))) return false;
  if (trimStr(camp.assignmentDecision) === 'refuse') return false;
  if (trimStr(camp.assignmentStatus) === 'Unassigned') return false;
  if (!trimStr(camp.hcwContactId)) return false;
  return true;
}

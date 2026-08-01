export function isCampAssigned(camp = {}) {
  if (camp.assignmentStatus === 'Assigned') return true;
  if (camp.lifecycleStage === 'execution' && camp.assignmentDecision === 'assign') return true;
  return false;
}

export function getAssignmentBlockers(camp = {}) {
  const blockers = [];

  if (['cancelled', 'rejected'].includes(camp.status)) {
    blockers.push(`Camp is ${String(camp.status).replaceAll('_', ' ')} and cannot be assigned.`);
    return blockers;
  }

  if (camp.status !== 'approved') {
    blockers.push('Camp must be approved before a resource can be assigned.');
    return blockers;
  }

  if (isCampAssigned(camp)) {
    blockers.push('A healthcare worker is already assigned to this camp.');
  }

  return blockers;
}

export function canAssignCamp(camp = {}) {
  return getAssignmentBlockers(camp).length === 0;
}

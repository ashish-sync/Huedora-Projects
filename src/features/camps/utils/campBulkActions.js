import { campStatusLabel } from '../constants/campLifecycle.js';
import { getExecutionBlockers } from './campExecutionActions.js';

const PERMISSION_MESSAGES = {
  approve: 'You do not have permission to approve camps',
  reject: 'You do not have permission to refuse camps',
  execute: 'You do not have permission to mark camps as executed',
};

const BULK_ACTION_PAST_TENSE = {
  approve: 'approved',
  reject: 'refused',
  execute: 'executed',
};

function campLabel(camp) {
  return camp.campId || camp.clientName || 'Camp';
}

function statusLabel(status) {
  return campStatusLabel(status);
}

function getCampBulkIssue(action, camp, auth) {
  if (action === 'approve') {
    if (camp.status !== 'pending_review') {
      return `${campLabel(camp)} is ${statusLabel(camp.status)} and cannot be approved`;
    }
    if (camp.canApprove === false) {
      const blocker = (camp.approvalBlockers || [])[0] || 'Camp is not ready for approval';
      return `${campLabel(camp)}: ${blocker}`;
    }
    return null;
  }

  if (action === 'reject') {
    if (camp.status !== 'pending_review') {
      return `${campLabel(camp)} is ${statusLabel(camp.status)} and cannot be refused`;
    }
    return null;
  }

  if (action === 'execute') {
    const blockers = getExecutionBlockers(camp);
    if (blockers.length) {
      return `${campLabel(camp)}: ${blockers[0]}`;
    }
    return null;
  }

  return 'Unsupported bulk action';
}

function canPerformBulkCampAction(action, auth) {
  if (action === 'approve') return auth.canApproveCamps();
  if (action === 'reject') return auth.canRejectCamps();
  if (action === 'execute') return auth.hasPermission('camps:execute');
  return false;
}

export function validateBulkCampAction(action, selectedCamps, auth) {
  if (!canPerformBulkCampAction(action, auth)) {
    return { ok: false, message: PERMISSION_MESSAGES[action] || 'You do not have permission for this action' };
  }

  if (!selectedCamps.length) {
    return { ok: false, message: 'Select at least one camp' };
  }

  const issues = [];
  const eligible = [];

  selectedCamps.forEach((camp) => {
    const issue = getCampBulkIssue(action, camp, auth);
    if (issue) {
      issues.push(issue);
    } else {
      eligible.push(camp);
    }
  });

  if (!eligible.length) {
    return {
      ok: false,
      message: issues.length === 1
        ? issues[0]
        : `None of the selected camps can be ${BULK_ACTION_PAST_TENSE[action] || action}: ${issues.join(' | ')}`,
    };
  }

  if (issues.length) {
    return {
      ok: false,
      message: `${issues.length} selected camp${issues.length === 1 ? '' : 's'} cannot be ${BULK_ACTION_PAST_TENSE[action] || action}: ${issues.join(' | ')}`,
    };
  }

  return {
    ok: true,
    ids: eligible.map((camp) => camp._id),
    count: eligible.length,
  };
}

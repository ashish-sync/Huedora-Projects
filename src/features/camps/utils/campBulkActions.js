const PERMISSION_MESSAGES = {
  approve: 'You do not have permission to approve camps',
  reject: 'You do not have permission to reject camps',
  execute: 'You do not have permission to mark camps as executed',
  delete: 'You do not have permission to delete camps',
};

function campLabel(camp) {
  return camp.campId || camp.clientName || 'Camp';
}

function statusLabel(status) {
  return String(status || '').replaceAll('_', ' ');
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
      return `${campLabel(camp)} is ${statusLabel(camp.status)} and cannot be rejected`;
    }
    return null;
  }

  if (action === 'execute') {
    if (camp.status !== 'approved') {
      return `${campLabel(camp)} is ${statusLabel(camp.status)} and cannot be marked executed`;
    }
    return null;
  }

  if (action === 'delete') {
    if (camp.status === 'executed' && !auth.isSuperAdmin()) {
      return `${campLabel(camp)} is executed and cannot be deleted`;
    }
    return null;
  }

  return 'Unsupported bulk action';
}

function canPerformBulkCampAction(action, auth) {
  if (action === 'approve') return auth.canApproveCamps();
  if (action === 'reject') return auth.canRejectCamps();
  if (action === 'execute') return auth.hasPermission('camps:execute');
  if (action === 'delete') {
    return auth.hasPermission('camps:update') || auth.hasPermission('camps:approve');
  }
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
        : `None of the selected camps can be ${action}d: ${issues.join(' | ')}`,
    };
  }

  if (issues.length) {
    return {
      ok: false,
      message: `${issues.length} selected camp${issues.length === 1 ? '' : 's'} cannot be ${action}d: ${issues.join(' | ')}`,
    };
  }

  return {
    ok: true,
    ids: eligible.map((camp) => camp._id),
    count: eligible.length,
  };
}

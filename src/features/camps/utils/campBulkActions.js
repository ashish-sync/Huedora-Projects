import { campStatusLabel } from '../constants/campLifecycle.js';
import { getExecutionBlockers } from './campExecutionActions.js';

const PERMISSION_MESSAGES = {
  approve: 'You do not have permission to approve camps',
  reject: 'You do not have permission to refuse camps',
  execute: 'You do not have permission to mark camps as executed',
  delete: 'Only administrators can delete camps',
  confirmPayment: 'You do not have permission to confirm payment',
  hold: 'You do not have permission to hold payment',
  unhold: 'You do not have permission to unhold payment',
  releaseHold: 'You do not have permission to unhold payment',
  submitToFinance: 'You do not have permission to submit camps to Finance One',
};

const BULK_ACTION_PAST_TENSE = {
  approve: 'approved',
  reject: 'refused',
  execute: 'executed',
  delete: 'deleted',
  confirmPayment: 'confirmed',
  hold: 'put on hold',
  unhold: 'unheld',
  releaseHold: 'unheld',
  submitToFinance: 'submitted to Finance One',
};

function campLabel(camp) {
  return camp.campId || camp.clientName || 'Camp';
}

function statusLabel(status) {
  return campStatusLabel(status);
}

function normalizePaymentSubmitStatus(value) {
  return String(value || '').trim() || 'payment_not_checked';
}

function isPaid(camp) {
  return String(camp.financePaymentStatus || '').trim().toLowerCase() === 'paid';
}

function isFinancialCamp(camp) {
  return String(camp.lifecycleStage || '').trim() === 'financial';
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

  if (action === 'delete') {
    return null;
  }

  if (action === 'confirmPayment') {
    if (!isFinancialCamp(camp)) {
      return `${campLabel(camp)} is not in Financial stage`;
    }
    if (isPaid(camp)) {
      return `${campLabel(camp)} is already paid`;
    }
    const submit = normalizePaymentSubmitStatus(camp.paymentSubmitStatus);
    if (submit === 'payment_hold') {
      return `${campLabel(camp)} is on Hold — Unhold before Confirm Payment`;
    }
    if (submit === 'payment_confirmed') {
      return `${campLabel(camp)} payment is already confirmed`;
    }
    return null;
  }

  if (action === 'hold') {
    if (!isFinancialCamp(camp)) {
      return `${campLabel(camp)} is not in Financial stage`;
    }
    if (isPaid(camp)) {
      return `${campLabel(camp)} is already paid and cannot be put on Hold`;
    }
    if (camp.submittedToFinanceAt) {
      return `${campLabel(camp)} was already submitted to Finance One`;
    }
    if (normalizePaymentSubmitStatus(camp.paymentSubmitStatus) === 'payment_hold') {
      return `${campLabel(camp)} is already on Hold`;
    }
    return null;
  }

  if (action === 'unhold' || action === 'releaseHold') {
    if (!isFinancialCamp(camp)) {
      return `${campLabel(camp)} is not in Financial stage`;
    }
    if (normalizePaymentSubmitStatus(camp.paymentSubmitStatus) !== 'payment_hold') {
      return `${campLabel(camp)} is not on Hold`;
    }
    return null;
  }

  if (action === 'submitToFinance') {
    if (!isFinancialCamp(camp)) {
      return `${campLabel(camp)} is not in Financial stage`;
    }
    if (camp.submittedToFinanceAt) {
      return `${campLabel(camp)} was already submitted to Finance One`;
    }
    if (normalizePaymentSubmitStatus(camp.paymentSubmitStatus) === 'payment_hold') {
      return `${campLabel(camp)} is on Hold — Unhold before submit`;
    }
    if (normalizePaymentSubmitStatus(camp.paymentSubmitStatus) !== 'payment_confirmed') {
      return `${campLabel(camp)} needs Confirm Payment before submit`;
    }
    return null;
  }

  return 'Unsupported bulk action';
}

function canPerformBulkCampAction(action, auth) {
  if (action === 'delete') return auth.isSuperAdmin?.() === true;
  if (action === 'approve') return auth.canApproveCamps();
  if (action === 'reject') return auth.canRejectCamps();
  if (action === 'execute') return auth.hasPermission('camps:execute');
  if (action === 'confirmPayment' || action === 'hold' || action === 'unhold' || action === 'releaseHold') {
    return auth.hasPermission('finance:write');
  }
  if (action === 'submitToFinance') {
    return auth.hasPermission('camps:request')
      || auth.hasPermission('camps:approve')
      || auth.hasPermission('camps:update')
      || auth.hasPermission('finance:write');
  }
  return false;
}

/** Finance bulk allows a partial eligible set; request approve/refuse stay all-or-nothing. */
function allowsPartialEligibility(action) {
  return ['confirmPayment', 'hold', 'unhold', 'releaseHold', 'submitToFinance'].includes(action);
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

  if (issues.length && !allowsPartialEligibility(action)) {
    return {
      ok: false,
      message: `${issues.length} selected camp${issues.length === 1 ? '' : 's'} cannot be ${BULK_ACTION_PAST_TENSE[action] || action}: ${issues.join(' | ')}`,
    };
  }

  return {
    ok: true,
    ids: eligible.map((camp) => camp._id),
    count: eligible.length,
    skipped: issues,
  };
}

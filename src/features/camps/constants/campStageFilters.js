import { REQUEST_REVIEW_FILTER_OPTIONS } from './requestReviewStatus.js';

export const ASSIGNMENT_STAGE_FILTER_OPTIONS = [
  { value: '', label: 'Camps in Assignment' },
  { value: 'assigned', label: 'Assigned Camps' },
  { value: 'unassigned', label: 'Unassigned Camps' },
  { value: 'cancelled_by_tcpl', label: 'Cancelled by TCPL' },
  { value: 'cancelled_by_client', label: 'Cancelled by Client' },
];

export const EXECUTION_STAGE_FILTER_OPTIONS = [
  { value: '', label: 'Camps in Execution' },
  { value: 'cancelled_by_tcpl', label: 'Cancelled by TCPL' },
  { value: 'cancelled_by_client', label: 'Cancelled by Client' },
  { value: 'ongoing', label: 'Camp Ongoing' },
  { value: 'yet_to_start', label: 'Camp Scheduled' },
  { value: 'completed', label: 'Camp Completed' },
  { value: 'executed', label: 'Marked Executed' },
];

export const FINANCIAL_STAGE_FILTER_OPTIONS = [
  { value: '', label: 'Camps in Financial' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'payment_verified', label: 'Payment Verified' },
  { value: 'payment_on_hold', label: 'Payment On Hold' },
  { value: 'payment_completed', label: 'Payment Completed' },
];

export function stageFilterLabel(stage, value) {
  const optionsByStage = {
    request: REQUEST_REVIEW_FILTER_OPTIONS,
    assignment: ASSIGNMENT_STAGE_FILTER_OPTIONS,
    execution: EXECUTION_STAGE_FILTER_OPTIONS,
    financial: FINANCIAL_STAGE_FILTER_OPTIONS,
  };
  const options = optionsByStage[stage] || [];
  return options.find((option) => option.value === value)?.label || String(value || '').replaceAll('_', ' ');
}

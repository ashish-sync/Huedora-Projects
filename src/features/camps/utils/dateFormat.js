export {
  formatDate,
  formatDateTime,
  formatTime,
  formatDateRangeLabel,
  toApiDateValue,
  todayIso,
  formatDate as formatDateDDMMYYYY,
  formatDateTime as formatDateTimeDDMMYYYY,
} from '../../../shared/dateFormat.js';

export function formatOverdueExecutionMessage(endsAt, now = new Date()) {
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) {
    return 'Awaiting execution';
  }

  const diffMs = now.getTime() - end.getTime();
  if (diffMs < 60000) {
    return 'Expected just now, awaiting execution';
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    const unit = diffMinutes === 1 ? 'minute' : 'minutes';
    return `Expected ${diffMinutes} ${unit} ago, awaiting execution`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    const unit = diffHours === 1 ? 'hour' : 'hours';
    return `Expected ${diffHours} ${unit} ago, awaiting execution`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const unit = diffDays === 1 ? 'day' : 'days';
  return `Expected ${diffDays} ${unit} ago, awaiting execution`;
}

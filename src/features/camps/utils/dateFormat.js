export function formatDateDDMMYYYY(value) {
  if (!value) return '';

  const text = String(value).trim();
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return text;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTimeDDMMYYYY(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatDateDDMMYYYY(date)} ${time}`;
}

export function toApiDateValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return text;

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return text;
}

export function formatDateRangeLabel(dateFrom, dateTo) {
  const from = dateFrom ? formatDateDDMMYYYY(dateFrom) : '...';
  const to = dateTo ? formatDateDDMMYYYY(dateTo) : '...';
  return `${from} to ${to}`;
}

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

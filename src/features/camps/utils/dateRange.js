export function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function getQuickDateRange(preset) {
  const today = getTodayDate();

  if (preset === 'today') {
    const value = toDateInputValue(today);
    return { dateFrom: value, dateTo: value };
  }

  if (preset === 'yesterday') {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    const value = toDateInputValue(date);
    return { dateFrom: value, dateTo: value };
  }

  if (preset === 'tomorrow') {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    const value = toDateInputValue(date);
    return { dateFrom: value, dateTo: value };
  }

  return { dateFrom: '', dateTo: '' };
}

export function matchQuickPreset(dateFrom, dateTo) {
  if (!dateFrom || !dateTo || dateFrom !== dateTo) return null;

  const presets = ['today', 'yesterday', 'tomorrow'];
  return presets.find((preset) => {
    const range = getQuickDateRange(preset);
    return range.dateFrom === dateFrom && range.dateTo === dateTo;
  }) || null;
}

export function getDefaultMonthDateRange() {
  const to = getTodayDate();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return {
    dateFrom: toDateInputValue(from),
    dateTo: toDateInputValue(to),
  };
}

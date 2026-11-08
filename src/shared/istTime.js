/** TYLO One business-calendar timezone. Date-only camp fields remain YYYY-MM-DD. */
export const IST_TIME_ZONE = 'Asia/Kolkata';

const FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function istTodayIso(now = new Date()) {
  const values = Object.fromEntries(
    FORMATTER.formatToParts(new Date(now))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

/** QIE post-upload verification indicator helpers (Contact Directory). */

export const QIE_INDICATOR = Object.freeze({
  GREY: 'grey',
  AMBER: 'amber',
  GREEN: 'green',
  RED: 'red',
});

export function resolveQieIndicator({ url, summary } = {}) {
  const fromSummary = String(summary?.indicator || '').trim().toLowerCase();
  if (fromSummary === QIE_INDICATOR.GREEN
    || fromSummary === QIE_INDICATOR.RED
    || fromSummary === QIE_INDICATOR.AMBER
    || fromSummary === QIE_INDICATOR.GREY) {
    return fromSummary;
  }
  if (!String(url || '').trim()) return QIE_INDICATOR.GREY;
  return QIE_INDICATOR.AMBER;
}

export function qieIndicatorLabel(indicator) {
  switch (indicator) {
    case QIE_INDICATOR.GREEN:
      return 'Verified successfully';
    case QIE_INDICATOR.RED:
      return 'Discrepancy or unsuccessful verification';
    case QIE_INDICATOR.AMBER:
      return 'Processing or HR review pending';
    default:
      return 'Educational certificate not uploaded';
  }
}

export function qieIndicatorGlyph(indicator) {
  switch (indicator) {
    case QIE_INDICATOR.GREEN:
      return '✓';
    case QIE_INDICATOR.RED:
      return '✕';
    case QIE_INDICATOR.AMBER:
      return '●';
    default:
      return '○';
  }
}

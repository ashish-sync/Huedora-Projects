import { INDIAN_HEALTHCARE_INSIGHTS } from './indianHealthcareInsights.js';

const SESSION_KEY = 'tylo_insight_session';

function hashString(value) {
  let hash = 0;
  const str = String(value);
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function insightAt(index) {
  const total = INDIAN_HEALTHCARE_INSIGHTS.length;
  if (!total) return { tag: 'TYLO One', text: 'Thank you for powering healthcare activation across India.', tone: 'motivate' };
  const safe = ((index % total) + total) % total;
  return INDIAN_HEALTHCARE_INSIGHTS[safe];
}

/**
 * Pick an insight index.
 * @param {'daily' | 'session'} mode — daily rotates at midnight; session is fresh each login.
 */
export function pickHealthcareInsightIndex({ userId = '', mode = 'daily' } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  let seed = `${day}|${userId}`;

  if (mode === 'session' && typeof sessionStorage !== 'undefined') {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    seed = `session|${sessionId}|${userId}`;
  }

  return hashString(seed) % INDIAN_HEALTHCARE_INSIGHTS.length;
}

export function pickHealthcareInsight(options = {}) {
  return insightAt(pickHealthcareInsightIndex(options));
}

/** Call after successful login so the next home visit shows a new fact. */
export function beginInsightSession() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(
    SESSION_KEY,
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function clearInsightSession() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function totalHealthcareInsights() {
  return INDIAN_HEALTHCARE_INSIGHTS.length;
}

export { insightAt };

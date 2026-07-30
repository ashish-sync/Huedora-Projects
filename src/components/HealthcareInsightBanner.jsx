import { useMemo, useState } from 'react';
import {
  insightAt,
  pickHealthcareInsight,
  pickHealthcareInsightIndex,
  totalHealthcareInsights,
} from '../shared/pickHealthcareInsight.js';

/**
 * @param {'login' | 'home'} variant
 * @param {string} [userId]
 * @param {boolean} [allowShuffle] — show “another fact” on home
 */
export default function HealthcareInsightBanner({
  variant = 'home',
  userId = '',
  allowShuffle = false,
}) {
  const mode = variant === 'login' ? 'daily' : 'session';
  const baseIndex = useMemo(
    () => pickHealthcareInsightIndex({ userId, mode }),
    [userId, mode]
  );
  const [offset, setOffset] = useState(0);

  const insight = useMemo(() => {
    if (offset === 0 && variant === 'login') {
      return pickHealthcareInsight({ userId, mode });
    }
    return insightAt(baseIndex + offset);
  }, [baseIndex, offset, userId, mode, variant]);

  const shuffle = () => {
    setOffset((prev) => (prev + 7) % totalHealthcareInsights());
  };

  return (
    <aside
      className={`health-insight health-insight--${variant} health-insight--${insight.tone || 'fact'}`}
      aria-label="Indian healthcare insight"
    >
      <div className="health-insight-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 21s-6.5-4.2-6.5-9.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8C21.5 16.8 12 21 12 21Z" />
          <path d="M12 11v3M12 8h.01" strokeLinecap="round" />
        </svg>
      </div>
      <div className="health-insight-body">
        <p className="health-insight-tag">{insight.tag}</p>
        <p className="health-insight-text">{insight.text}</p>
        {variant === 'home' ? (
          <p className="health-insight-foot">
            {allowShuffle ? (
              <button type="button" className="health-insight-shuffle" onClick={shuffle}>
                Show another fact
              </button>
            ) : null}
            <span className="health-insight-note">Fresh insight each time you sign in</span>
          </p>
        ) : (
          <p className="health-insight-foot">
            <span className="health-insight-note">A new fact every day on this screen</span>
          </p>
        )}
      </div>
    </aside>
  );
}

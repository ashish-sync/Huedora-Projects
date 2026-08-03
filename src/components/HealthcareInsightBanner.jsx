import { useMemo, useState } from 'react';
import {
  insightAt,
  insightFromPool,
  pickHealthcareInsight,
  pickHealthcareInsightIndex,
  pickInsightPoolIndex,
  totalHealthcareInsights,
} from '../shared/pickHealthcareInsight.js';

/**
 * @param {'login' | 'home'} variant
 * @param {string} [userId]
 * @param {boolean} [allowShuffle] — show “another fact” on home
 * @param {string} [sectionTitle] — fixed heading (e.g. “Why your work counts”)
 * @param {Array} [insightPool] — optional subset of insights to rotate
 */
export default function HealthcareInsightBanner({
  variant = 'home',
  userId = '',
  allowShuffle = false,
  sectionTitle = '',
  insightPool = null,
}) {
  const mode = variant === 'login' ? 'daily' : 'session';
  const pool = insightPool?.length ? insightPool : null;
  const poolSize = pool?.length || totalHealthcareInsights();

  const baseIndex = useMemo(
    () => (pool
      ? pickInsightPoolIndex(pool, { userId, mode })
      : pickHealthcareInsightIndex({ userId, mode })),
    [pool, userId, mode],
  );
  const [offset, setOffset] = useState(0);

  const insight = useMemo(() => {
    if (offset === 0 && variant === 'login' && !pool) {
      return pickHealthcareInsight({ userId, mode });
    }
    if (pool) {
      return insightFromPool(pool, baseIndex + offset);
    }
    return insightAt(baseIndex + offset);
  }, [baseIndex, offset, userId, mode, variant, pool]);

  const shuffle = () => {
    setOffset((prev) => (prev + 1) % poolSize);
  };

  const heading = sectionTitle || insight.tag;

  return (
    <aside
      className={`health-insight health-insight--${variant} health-insight--${insight.tone || 'fact'}${sectionTitle ? ' health-insight--section' : ''}`}
      aria-label={sectionTitle || 'Indian healthcare insight'}
    >
      <div className="health-insight-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 21s-6.5-4.2-6.5-9.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8C21.5 16.8 12 21 12 21Z" />
          <path d="M12 11v3M12 8h.01" strokeLinecap="round" />
        </svg>
      </div>
      <div className="health-insight-body">
        <div className="health-insight-head">
          <p className="health-insight-tag">{heading}</p>
          {variant === 'home' && allowShuffle ? (
            <button type="button" className="health-insight-shuffle" onClick={shuffle}>
              Another fact
            </button>
          ) : null}
        </div>
        <p className="health-insight-text">{insight.text}</p>
        {variant === 'home' && !sectionTitle ? (
          <p className="health-insight-foot">
            <span className="health-insight-note">Fresh insight each time you sign in</span>
          </p>
        ) : null}
        {variant === 'login' ? (
          <p className="health-insight-foot">
            <span className="health-insight-note">A new fact every day on this screen</span>
          </p>
        ) : null}
      </div>
    </aside>
  );
}

/** Leave a thin inset so the stamp sits just inside the box borders. */
export const CLICK_TO_SIGN_FIT_INSET = 0.94;
export const CLICK_TO_SIGN_MAX_SCALE = 1.85;

/**
 * Measure stamp content width including child CSS transforms (e.g. historical scaleX).
 * offsetWidth/scrollWidth ignore those transforms and under-fit the stamp.
 */
export function measureClickToSignContentWidth(stamp) {
  if (!stamp) return 0;
  const nameEl = stamp.querySelector('.ti-click-sign__name, .signature-name');
  const metaEl = stamp.querySelector('.ti-click-sign__meta, .signature-date');
  const nameW = nameEl ? nameEl.getBoundingClientRect().width : 0;
  const metaW = metaEl ? metaEl.getBoundingClientRect().width : 0;
  return Math.max(nameW, metaW, stamp.scrollWidth || 0, stamp.offsetWidth || 0);
}

/**
 * Scale `.ti-click-sign` stamps to fit their `.ti-click-sign-shell` width.
 * Used by live preview and PDF/print export clones.
 */
export function fitClickToSignStamps(root, {
  inset = CLICK_TO_SIGN_FIT_INSET,
  maxScale = CLICK_TO_SIGN_MAX_SCALE,
} = {}) {
  if (!root) return;
  const shells = root.classList?.contains('ti-click-sign-shell')
    ? [root]
    : [...(root.querySelectorAll?.('.ti-click-sign-shell') || [])];

  shells.forEach((shell) => {
    const stamp = shell.querySelector('.ti-click-sign');
    if (!stamp) return;
    stamp.style.transform = 'scale(1)';
    // Force layout after reset before measuring.
    void stamp.offsetWidth;
    const available = shell.clientWidth;
    if (!available) return;
    const needed = measureClickToSignContentWidth(stamp);
    if (!needed) return;
    const next = Math.min(maxScale, (available * inset) / needed);
    const scale = Number.isFinite(next) && next > 0 ? next : 1;
    stamp.style.transform = `scale(${scale})`;
  });
}

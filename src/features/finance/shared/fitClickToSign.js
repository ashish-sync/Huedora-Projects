/** Leave a thin inset so the stamp sits just inside the box borders. */
export const CLICK_TO_SIGN_FIT_INSET = 0.92;
/** Never enlarge — upscaling overflows height and gets clipped by overflow:hidden. */
export const CLICK_TO_SIGN_MAX_SCALE = 1;
export const CLICK_TO_SIGN_MIN_SCALE = 0.4;

/**
 * Measure stamp content width including child CSS transforms.
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

export function measureClickToSignContentHeight(stamp) {
  if (!stamp) return 0;
  const rectH = stamp.getBoundingClientRect().height || 0;
  return Math.max(rectH, stamp.scrollHeight || 0, stamp.offsetHeight || 0);
}

/**
 * Scale `.ti-click-sign` stamps to fit their `.ti-click-sign-shell` box
 * (width and height). Only scales down — never enlarges.
 */
export function fitClickToSignStamps(root, {
  inset = CLICK_TO_SIGN_FIT_INSET,
  maxScale = CLICK_TO_SIGN_MAX_SCALE,
  minScale = CLICK_TO_SIGN_MIN_SCALE,
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

    const availableW = shell.clientWidth;
    const availableH = shell.clientHeight;
    const neededW = measureClickToSignContentWidth(stamp);
    const neededH = measureClickToSignContentHeight(stamp);
    if (!neededW && !neededH) return;

    let scale = 1;
    if (availableW > 0 && neededW > 0) {
      scale = Math.min(scale, (availableW * inset) / neededW);
    }
    if (availableH > 0 && neededH > 0) {
      scale = Math.min(scale, (availableH * inset) / neededH);
    }
    scale = Math.min(maxScale, Math.max(minScale, scale));
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    stamp.style.transform = `scale(${scale})`;
  });
}

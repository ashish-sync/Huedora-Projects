/**
 * Browser fullscreen (F11-style) for TYLO One after sign-in.
 * Must be called synchronously inside a user gesture (click handler).
 */

function getFullscreenElement() {
  return (
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement
    || null
  );
}

function getRequestMethod(el) {
  return (
    el.requestFullscreen
    || el.webkitRequestFullscreen
    || el.msRequestFullscreen
    || null
  );
}

function getExitMethod() {
  return document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || null;
}

/** Enter fullscreen on the document root (Chrome / Edge / Firefox). */
export function requestAppFullscreen() {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (getFullscreenElement()) return Promise.resolve(true);

  const root = document.documentElement;
  const request = getRequestMethod(root);
  if (!request) return Promise.resolve(false);

  try {
    const result = request.call(root);
    if (result && typeof result.then === 'function') {
      return result.then(() => true).catch(() => false);
    }
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

/** Leave fullscreen (e.g. on logout). */
export function exitAppFullscreen() {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (!getFullscreenElement()) return Promise.resolve(true);

  const exit = getExitMethod();
  if (!exit) return Promise.resolve(false);

  try {
    const result = exit.call(document);
    if (result && typeof result.then === 'function') {
      return result.then(() => true).catch(() => false);
    }
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

export function isAppFullscreen() {
  return Boolean(getFullscreenElement());
}

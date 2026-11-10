const EXTERNAL_KEY = 'tylo_client_one_session';
const PREVIEW_KEY = 'tylo_client_one_preview_session';

function storageKey(mode = 'external') {
  return mode === 'preview' ? PREVIEW_KEY : EXTERNAL_KEY;
}

function readRaw(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readClientOneSession(mode = 'external') {
  return readRaw(storageKey(mode));
}

export function getClientOneToken(mode = 'external') {
  return readClientOneSession(mode)?.token || '';
}

export function setClientOneSession(session, mode = 'external') {
  if (typeof window === 'undefined') return;
  const next = {
    ...(session || {}),
    mode: mode === 'preview' ? 'preview' : 'external',
  };
  sessionStorage.setItem(storageKey(mode), JSON.stringify(next));
}

export function clearClientOneSession(mode = 'external') {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(storageKey(mode));
}

export function clearAllClientOneSessions() {
  clearClientOneSession('external');
  clearClientOneSession('preview');
}

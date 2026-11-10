import { apiUrl } from './config.js';

/** Browser-ready URL for a user avatar from publicUser.avatarUrl. */
export function resolveUserAvatarSrc(avatarUrl = '') {
  const raw = String(avatarUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) {
    return raw;
  }
  return apiUrl(raw);
}

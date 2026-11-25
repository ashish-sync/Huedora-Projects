/**
 * @vitest-environment node
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Contact Directory caching policy', () => {
  const src = fs.readFileSync(path.join(__dirname, 'ContactDirectoryPage.jsx'), 'utf8');

  it('loads lists via dynamic URLSearchParams (page, limit, search, category)', () => {
    expect(src).toMatch(/new URLSearchParams\(\{\s*page:\s*String\(page\),\s*limit:\s*String\(limit\)\s*\}\)/);
    expect(src).toMatch(/params\.set\('q',\s*debouncedQ\.trim\(\)\)/);
    expect(src).toMatch(/params\.set\('contactCategory',\s*categoryFilter\)/);
    expect(src).toMatch(/api\(`\/contacts\?\$\{params\}`\)/);
    expect(src).not.toMatch(/fetchContactsList/);
    // Outdated hardcoded HCW list call must stay removed.
    expect(src).not.toMatch(/api\('\/contacts\?contactCategory=Healthcare Worker/);
  });

  it('invalidates picker caches after create/update and KYC uploads', () => {
    const drawerSrc = fs.readFileSync(path.join(__dirname, 'ContactDirectoryDrawer.jsx'), 'utf8');
    expect(drawerSrc).toMatch(/invalidateContactsCaches/);

    const saveIdx = drawerSrc.indexOf('await api(\'/contacts\'');
    const saveInvalidateIdx = drawerSrc.indexOf('invalidateContactsCaches()', saveIdx);
    expect(saveIdx).toBeGreaterThan(-1);
    expect(saveInvalidateIdx).toBeGreaterThan(saveIdx);

    const patchIdx = drawerSrc.indexOf('api(`/contacts/${editId}`, { method: \'PATCH\'');
    const patchInvalidateIdx = drawerSrc.indexOf('invalidateContactsCaches()', Math.max(patchIdx, saveIdx));
    expect(patchIdx).toBeGreaterThan(-1);
    expect(patchInvalidateIdx).toBeGreaterThan(patchIdx);

    const kycIdx = drawerSrc.indexOf('kyc-document');
    const kycInvalidateIdx = drawerSrc.indexOf('invalidateContactsCaches()', kycIdx);
    expect(kycIdx).toBeGreaterThan(-1);
    expect(kycInvalidateIdx).toBeGreaterThan(kycIdx);
  });
});

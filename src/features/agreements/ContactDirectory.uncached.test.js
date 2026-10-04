/**
 * @vitest-environment node
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Contact Directory caching policy', () => {
  it('loads lists via api() directly and invalidates picker caches after mutations', () => {
    const src = fs.readFileSync(path.join(__dirname, 'ContactDirectoryPage.jsx'), 'utf8');
    expect(src).toMatch(/invalidateContactsCaches/);
    expect(src).not.toMatch(/fetchContactsList/);
    expect(src).toMatch(/api\(`\/contacts\?\$\{params\}`\)/);
    expect(src).toMatch(/api\('\/contacts\?contactCategory=Healthcare Worker/);
  });
});

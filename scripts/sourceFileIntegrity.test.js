import { describe, expect, it } from 'vitest';
import {
  CRITICAL_FILES,
  evaluateFileIntegrity,
  isSourcePath,
  MIN_BYTES_FOR_SHRINK_CHECK,
} from './sourceFileIntegrity.js';

describe('source file integrity', () => {
  it('treats CSS and JS as source files', () => {
    expect(isSourcePath('src/features/camps/campOps.css')).toBe(true);
    expect(isSourcePath('src/features/camps/CampOpsLayout.jsx')).toBe(true);
    expect(isSourcePath('public/brand.png')).toBe(false);
  });

  it('rejects a zero-byte source file', () => {
    const issues = evaluateFileIntegrity({
      posixPath: 'src/features/camps/campOps.css',
      currentBytes: 0,
      headBytes: 239043,
      criticalMinBytes: 200000,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['empty', 'critical-too-small', 'major-shrink']),
    );
  });

  it('rejects an unexpected majority shrink of a large file', () => {
    const headBytes = MIN_BYTES_FOR_SHRINK_CHECK * 10;
    const issues = evaluateFileIntegrity({
      posixPath: 'src/app/big.css',
      currentBytes: Math.floor(headBytes * 0.2),
      headBytes,
    });

    expect(issues).toEqual([
      expect.objectContaining({ code: 'major-shrink' }),
    ]);
  });

  it('allows a modest targeted edit', () => {
    const issues = evaluateFileIntegrity({
      posixPath: 'src/features/camps/campOps.css',
      currentBytes: 239200,
      headBytes: 239043,
      criticalMinBytes: 200000,
    });

    expect(issues).toEqual([]);
  });

  it('keeps a hard minimum on campOps.css', () => {
    expect(CRITICAL_FILES[0]).toMatchObject({
      posixPath: 'src/features/camps/campOps.css',
      minBytes: 200000,
    });
  });
});

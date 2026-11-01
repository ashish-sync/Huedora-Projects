import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CRITICAL_FILES } from './sourceFileIntegrity.js';
import {
  backupProtectedSources,
  inspectCriticalFiles,
  repairDamagedCriticalFiles,
} from './sourceFileProtection.js';

const posixPath = CRITICAL_FILES[0].posixPath;
const healthy = `${'A'.repeat(220000)}\n`;
let tmp = '';
let backupRoot = '';

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function seedRepo() {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'tylo-protect-'));
  backupRoot = path.join(tmp, 'backup-off-workspace');
  const filePath = path.join(tmp, ...posixPath.split('/'));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, healthy);
  git(tmp, ['init']);
  git(tmp, ['checkout', '-B', 'main']);
  git(tmp, ['add', '--', posixPath]);
  git(tmp, ['-c', 'user.name=Protect', '-c', 'user.email=protect@tylo.local', 'commit', '-m', 'seed']);
  return filePath;
}

afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = '';
  backupRoot = '';
});

describe('protected source backup and repair', () => {
  it('saves a known-good HEAD snapshot outside the repo', () => {
    seedRepo();
    const results = backupProtectedSources(tmp, backupRoot);
    expect(results[0]).toMatchObject({
      posixPath,
      saved: true,
    });
    expect(results[0].bytes).toBeGreaterThan(200000);
    const backed = readFileSync(path.join(backupRoot, 'client', ...posixPath.split('/')), 'utf8');
    expect(backed.length).toBe(healthy.length);
  }, 20000);

  it('restores an emptied file from the off-workspace backup when HEAD is also empty', () => {
    const filePath = seedRepo();
    backupProtectedSources(tmp, backupRoot);
    writeFileSync(filePath, '');
    git(tmp, ['add', '--', posixPath]);
    git(tmp, ['-c', 'user.name=Protect', '-c', 'user.email=protect@tylo.local', 'commit', '-m', 'empty']);

    const before = inspectCriticalFiles(tmp, backupRoot);
    expect(before[0].issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['empty']),
    );

    const repaired = repairDamagedCriticalFiles(tmp, backupRoot);
    expect(repaired[0].restored).toBe(true);
    expect(repaired[0].from).toBe('backup');
    expect(readFileSync(filePath, 'utf8').length).toBe(healthy.length);
  }, 20000);
});

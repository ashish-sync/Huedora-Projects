import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CRITICAL_FILES, evaluateFileIntegrity, toPosixPath } from './sourceFileIntegrity.js';

export function defaultBackupRoot() {
  if (process.env.TYLO_PROTECTED_SOURCE_BACKUP) {
    return process.env.TYLO_PROTECTED_SOURCE_BACKUP;
  }
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'TyloOne', 'protected-sources');
  }
  return path.join(os.homedir(), '.local', 'share', 'tylo-one', 'protected-sources');
}

export function backupPaths(posixPath, backupRoot = defaultBackupRoot()) {
  const relative = toPosixPath(posixPath).replace(/^\/+/, '');
  const filePath = path.join(backupRoot, 'client', ...relative.split('/'));
  return {
    filePath,
    metaPath: `${filePath}.meta.json`,
    dir: path.dirname(filePath),
  };
}

function git(repoRoot, args, encoding = 'utf8') {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitOk(repoRoot, args, encoding = 'utf8') {
  try {
    return git(repoRoot, args, encoding);
  } catch {
    return encoding === 'buffer' ? Buffer.alloc(0) : '';
  }
}

export function blobSize(repoRoot, spec) {
  const raw = String(gitOk(repoRoot, ['cat-file', '-s', spec]) || '').trim();
  if (!raw) return null;
  const size = Number(raw);
  return Number.isFinite(size) ? size : null;
}

export function workingTreeSize(repoRoot, posixPath) {
  const abs = path.join(repoRoot, ...toPosixPath(posixPath).split('/'));
  if (!existsSync(abs)) return null;
  return statSync(abs).size;
}

export function readBackupMeta(posixPath, backupRoot = defaultBackupRoot()) {
  const { metaPath } = backupPaths(posixPath, backupRoot);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

export function backupBytes(posixPath, backupRoot = defaultBackupRoot()) {
  const { filePath } = backupPaths(posixPath, backupRoot);
  if (existsSync(filePath)) return statSync(filePath).size;
  const meta = readBackupMeta(posixPath, backupRoot);
  return Number.isFinite(meta?.bytes) ? meta.bytes : null;
}

function isHealthySnapshot({ currentBytes, headBytes, backupBytes, criticalMinBytes }) {
  return evaluateFileIntegrity({
    posixPath: 'snapshot',
    currentBytes,
    headBytes,
    backupBytes,
    criticalMinBytes,
    missing: currentBytes == null,
  }).length === 0;
}

export function writeKnownGoodBackup(repoRoot, item, backupRoot = defaultBackupRoot()) {
  const posixPath = item.posixPath;
  const headBytes = blobSize(repoRoot, `HEAD:${posixPath}`);
  if (!isHealthySnapshot({
    currentBytes: headBytes,
    headBytes,
    backupBytes: headBytes,
    criticalMinBytes: item.minBytes,
  })) {
    return { posixPath, saved: false, reason: 'HEAD is not a known-good snapshot' };
  }

  const contents = git(repoRoot, ['show', `HEAD:${posixPath}`], 'buffer');
  const hash = String(git(repoRoot, ['rev-parse', `HEAD:${posixPath}`])).trim();
  const { filePath, metaPath, dir } = backupPaths(posixPath, backupRoot);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, contents);
  writeFileSync(metaPath, `${JSON.stringify({
    posixPath,
    bytes: contents.length,
    gitHash: hash,
    savedAt: new Date().toISOString(),
    source: 'HEAD',
    repo: path.basename(repoRoot),
  }, null, 2)}\n`);
  return { posixPath, saved: true, bytes: contents.length, gitHash: hash, filePath };
}

export function backupProtectedSources(repoRoot, backupRoot = defaultBackupRoot()) {
  mkdirSync(backupRoot, { recursive: true });
  const results = CRITICAL_FILES.map((item) => writeKnownGoodBackup(repoRoot, item, backupRoot));
  writeFileSync(path.join(backupRoot, 'manifest.json'), `${JSON.stringify({
    updatedAt: new Date().toISOString(),
    backupRoot,
    files: results,
  }, null, 2)}\n`);
  return results;
}

export function restoreProtectedFile(repoRoot, posixPath, backupRoot = defaultBackupRoot()) {
  const abs = path.join(repoRoot, ...toPosixPath(posixPath).split('/'));
  const { filePath } = backupPaths(posixPath, backupRoot);
  mkdirSync(path.dirname(abs), { recursive: true });

  const headBytes = blobSize(repoRoot, `HEAD:${posixPath}`);
  const item = CRITICAL_FILES.find((entry) => entry.posixPath === toPosixPath(posixPath));
  if (isHealthySnapshot({
    currentBytes: headBytes,
    headBytes,
    backupBytes: headBytes,
    criticalMinBytes: item?.minBytes,
  })) {
    git(repoRoot, ['checkout', '--', posixPath]);
    return { posixPath, restored: true, from: 'HEAD', bytes: workingTreeSize(repoRoot, posixPath) };
  }

  if (!existsSync(filePath)) {
    return { posixPath, restored: false, reason: 'no HEAD blob or off-workspace backup' };
  }

  copyFileSync(filePath, abs);
  return { posixPath, restored: true, from: 'backup', bytes: statSync(abs).size };
}

export function inspectCriticalFiles(repoRoot, backupRoot = defaultBackupRoot()) {
  return CRITICAL_FILES.map((item) => {
    const currentBytes = workingTreeSize(repoRoot, item.posixPath);
    const issues = evaluateFileIntegrity({
      posixPath: item.posixPath,
      currentBytes,
      headBytes: blobSize(repoRoot, `HEAD:${item.posixPath}`),
      backupBytes: backupBytes(item.posixPath, backupRoot),
      criticalMinBytes: item.minBytes,
      missing: currentBytes == null,
    });
    return { ...item, currentBytes, issues };
  });
}

export function repairDamagedCriticalFiles(repoRoot, backupRoot = defaultBackupRoot()) {
  const repaired = [];
  for (const item of inspectCriticalFiles(repoRoot, backupRoot)) {
    if (!item.issues.length) continue;
    repaired.push({
      ...restoreProtectedFile(repoRoot, item.posixPath, backupRoot),
      issues: item.issues,
    });
  }
  return repaired;
}

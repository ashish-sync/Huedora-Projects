#!/usr/bin/env node
/**
 * Block empty, deleted, or unexpectedly gutted tracked source files.
 *
 *   node scripts/check-source-file-integrity.mjs
 *   node scripts/check-source-file-integrity.mjs --staged
 *   node scripts/check-source-file-integrity.mjs --push
 *   node scripts/check-source-file-integrity.mjs --fix
 *   node scripts/check-source-file-integrity.mjs --path src/features/camps/campOps.css
 *
 * Set TYLO_ALLOW_SOURCE_INTEGRITY=1 only for an intentional, reviewed shrink.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CRITICAL_FILES,
  evaluateFileIntegrity,
  formatIntegrityReport,
  isProtectedPath,
  isSourcePath,
  toPosixPath,
} from './sourceFileIntegrity.js';
import {
  backupBytes,
  blobSize,
  repairDamagedCriticalFiles,
  workingTreeSize,
} from './sourceFileProtection.js';

const CRITICAL_BY_PATH = new Map(CRITICAL_FILES.map((item) => [item.posixPath, item]));

function git(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitOk(repoRoot, args) {
  try {
    return git(repoRoot, args);
  } catch {
    return '';
  }
}

function parseNameList(raw) {
  return raw
    .split(/\0|\r?\n/)
    .map((line) => toPosixPath(line.trim()))
    .filter(Boolean);
}

function resolveRepoRoot(startDir = process.cwd()) {
  return git(startDir, ['rev-parse', '--show-toplevel']);
}

function collectPaths({ repoRoot, staged, onlyPath, push }) {
  if (onlyPath) return [toPosixPath(onlyPath)];

  const named = new Set();
  const diffArgs = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z']
    : ['diff', '--name-only', '--diff-filter=ACMRD', '-z'];

  for (const filePath of parseNameList(gitOk(repoRoot, diffArgs))) {
    named.add(filePath);
  }

  if (push) {
    const upstream = gitOk(repoRoot, ['rev-parse', '--abbrev-ref', '@{upstream}']);
    if (upstream) {
      for (const filePath of parseNameList(gitOk(repoRoot, ['diff', '--name-only', '--diff-filter=ACMRD', '-z', `${upstream}...HEAD`]))) {
        named.add(filePath);
      }
    }
  }

  for (const item of CRITICAL_FILES) {
    named.add(item.posixPath);
  }

  return [...named];
}

function currentSize({ repoRoot, posixPath, staged }) {
  if (staged) {
    const stagedSize = blobSize(repoRoot, `:${posixPath}`);
    if (stagedSize != null) return stagedSize;
    if (gitOk(repoRoot, ['diff', '--cached', '--name-only', '--diff-filter=D', '--', posixPath])) {
      return null;
    }
    return workingTreeSize(repoRoot, posixPath);
  }
  return workingTreeSize(repoRoot, posixPath);
}

export function checkSourceFileIntegrity({
  repoRoot = process.cwd(),
  staged = false,
  onlyPath = '',
  push = false,
} = {}) {
  const root = resolveRepoRoot(repoRoot);
  const issues = [];

  for (const posixPath of collectPaths({
    repoRoot: root, staged, onlyPath, push,
  })) {
    if (!isSourcePath(posixPath) && !isProtectedPath(posixPath)) continue;

    const currentBytes = currentSize({ repoRoot: root, posixPath, staged });
    const isCritical = CRITICAL_BY_PATH.has(posixPath);
    if (currentBytes == null && !onlyPath && !isCritical) continue;

    issues.push(...evaluateFileIntegrity({
      posixPath,
      currentBytes,
      headBytes: blobSize(root, `HEAD:${posixPath}`),
      backupBytes: backupBytes(posixPath),
      criticalMinBytes: CRITICAL_BY_PATH.get(posixPath)?.minBytes ?? null,
      missing: currentBytes == null,
    }));
  }

  return issues;
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

function parseArgs(argv) {
  const options = {
    staged: false, onlyPath: '', push: false, fix: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--staged') options.staged = true;
    else if (arg === '--push') options.push = true;
    else if (arg === '--fix') options.fix = true;
    else if (arg.startsWith('--path=')) options.onlyPath = arg.slice('--path='.length);
    else if (arg === '--path') {
      options.onlyPath = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--') continue;
    else if (!arg.startsWith('--') && !options.onlyPath) {
      options.onlyPath = arg;
    }
  }
  return options;
}

function printIssues(issues) {
  console.error(formatIntegrityReport(issues));
}

if (isMainModule()) {
  if (process.env.TYLO_ALLOW_SOURCE_INTEGRITY === '1') {
    console.warn('source-file-integrity: skipped because TYLO_ALLOW_SOURCE_INTEGRITY=1');
    process.exit(0);
  }

  const options = parseArgs(process.argv.slice(2));
  let issues;
  try {
    if (options.fix) {
      const root = resolveRepoRoot(process.cwd());
      const repaired = repairDamagedCriticalFiles(root);
      for (const item of repaired) {
        if (item.restored) {
          console.error(`source-file-protection: restored ${item.posixPath} from ${item.from} (${item.bytes} bytes)`);
        } else {
          console.error(`source-file-protection: could not restore ${item.posixPath}: ${item.reason}`);
        }
      }
    }
    issues = checkSourceFileIntegrity(options);
  } catch (error) {
    console.error(`source-file-integrity: ${error.message || error}`);
    process.exit(1);
  }

  if (issues.length) {
    printIssues(issues);
    process.exit(1);
  }

  console.log('source-file-integrity: ok');
}

#!/usr/bin/env node
/**
 * Prove empty writes and 50%+ shrinks are detected and blocked.
 * Uses a temporary git repo so the real campOps.css is never touched.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSourceFileIntegrity } from './check-source-file-integrity.mjs';
import { CRITICAL_FILES, evaluateFileIntegrity, formatIntegrityReport } from './sourceFileIntegrity.js';

const posixPath = CRITICAL_FILES[0].posixPath;
const minBytes = CRITICAL_FILES[0].minBytes;
const healthyBytes = 240000;

function writeBytes(filePath, size, char = 'A') {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, char.repeat(size));
}

function run(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const tmp = mkdtempSync(path.join(os.tmpdir(), 'tylo-integrity-'));
const filePath = path.join(tmp, ...posixPath.split('/'));
const results = [];

try {
  run(tmp, ['init']);
  run(tmp, ['checkout', '-B', 'main']);
  writeBytes(filePath, healthyBytes);
  run(tmp, ['add', '--', posixPath]);
  run(tmp, ['-c', 'user.name=Integrity', '-c', 'user.email=integrity@tylo.local', 'commit', '-m', 'seed protected css']);

  const emptyIssues = evaluateFileIntegrity({
    posixPath,
    currentBytes: 0,
    headBytes: healthyBytes,
    criticalMinBytes: minBytes,
  });
  writeBytes(filePath, 0);
  const emptyCheck = checkSourceFileIntegrity({ repoRoot: tmp, onlyPath: posixPath });
  results.push({
    name: 'empty file',
    blocked: emptyIssues.some((issue) => issue.code === 'empty') && emptyCheck.length > 0,
    report: formatIntegrityReport(emptyCheck),
  });

  writeBytes(filePath, healthyBytes);
  const half = Math.floor(healthyBytes * 0.4);
  writeBytes(filePath, half);
  const shrinkIssues = evaluateFileIntegrity({
    posixPath,
    currentBytes: half,
    headBytes: healthyBytes,
    criticalMinBytes: minBytes,
  });
  const shrinkCheck = checkSourceFileIntegrity({ repoRoot: tmp, onlyPath: posixPath });
  results.push({
    name: '50%+ size reduction',
    blocked: shrinkIssues.some((issue) => issue.code === 'major-shrink') && shrinkCheck.length > 0,
    report: formatIntegrityReport(shrinkCheck),
  });

  writeBytes(filePath, 0);
  const stagedEmpty = (() => {
    run(tmp, ['add', '--', posixPath]);
    const issues = checkSourceFileIntegrity({ repoRoot: tmp, staged: true, onlyPath: posixPath });
    run(tmp, ['restore', '--staged', '--', posixPath]);
    return issues;
  })();
  results.push({
    name: 'staged empty commit payload',
    blocked: stagedEmpty.some((issue) => issue.code === 'empty'),
    report: formatIntegrityReport(stagedEmpty),
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((item) => !item.blocked);
console.log('Source-file protection simulation (temp repo, real campOps.css untouched):');
for (const item of results) {
  console.log(`  ${item.blocked ? 'BLOCKED' : 'MISSED'} ${item.name}`);
  console.log(item.report.split('\n').map((line) => `    ${line}`).join('\n'));
}

if (failed.length) {
  console.error(`Simulation failed: ${failed.map((item) => item.name).join(', ')} not blocked.`);
  process.exit(1);
}

console.log('Simulation ok: empty writes and unexpected 50%+ reductions are detected and blocked.');
console.log(`Checker: ${fileURLToPath(import.meta.url)}`);

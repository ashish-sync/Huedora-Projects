#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, unlinkSync, watch, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_FILES } from './sourceFileIntegrity.js';
import {
  defaultBackupRoot,
  inspectCriticalFiles,
  repairDamagedCriticalFiles,
} from './sourceFileProtection.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupRoot = defaultBackupRoot();
const stateDir = path.join(backupRoot, 'watch');
const pidPath = path.join(stateDir, 'watch.pid');
const logPath = path.join(stateDir, 'watch.log');

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(logPath, line, { flag: 'a' });
  console.log(message.trim());
}

function alreadyRunning() {
  if (!existsSync(pidPath)) return false;
  const pid = Number(readFileSync(pidPath, 'utf8'));
  if (!Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return pid !== process.pid;
  } catch {
    return false;
  }
}

const DEBOUNCE_MS = 1500;
const POLL_MS = 8000;
let repairTimer = null;

function repair(reason) {
  const before = inspectCriticalFiles(repoRoot, backupRoot);
  const damaged = before.filter((item) => item.issues.length);
  if (!damaged.length) return;
  log(`detected damage after ${reason}: ${damaged.map((item) => item.posixPath).join(', ')}`);
  for (const result of repairDamagedCriticalFiles(repoRoot, backupRoot)) {
    log(result.restored
      ? `restored ${result.posixPath} from ${result.from} (${result.bytes} bytes)`
      : `restore failed ${result.posixPath}: ${result.reason}`);
  }
}

function scheduleRepair(reason) {
  if (repairTimer) clearTimeout(repairTimer);
  repairTimer = setTimeout(() => {
    repairTimer = null;
    try {
      repair(reason);
    } catch (error) {
      log(`repair failed after ${reason}: ${error.message || error}`);
    }
  }, DEBOUNCE_MS);
}

if (alreadyRunning()) {
  console.log(`protected-source watcher already running (pid ${readFileSync(pidPath, 'utf8').trim()})`);
  process.exit(0);
}

mkdirSync(stateDir, { recursive: true });
writeFileSync(pidPath, `${process.pid}\n`);
process.on('exit', () => {
  try {
    if (existsSync(pidPath) && Number(readFileSync(pidPath, 'utf8')) === process.pid) {
      unlinkSync(pidPath);
    }
  } catch {
    /* ignore */
  }
});

repair('startup');

const watchedDirs = new Set();
for (const item of CRITICAL_FILES) {
  const abs = path.join(repoRoot, ...item.posixPath.split('/'));
  const dir = path.dirname(abs);
  if (watchedDirs.has(dir) || !existsSync(dir)) continue;
  watchedDirs.add(dir);
  watch(dir, { persistent: true }, (_event, filename) => {
    if (!filename) {
      scheduleRepair('directory-change');
      return;
    }
    const changed = CRITICAL_FILES.some((entry) => entry.posixPath.endsWith(filename.replace(/\\/g, '/')));
    if (changed) scheduleRepair(`watch:${filename}`);
  });
}

setInterval(() => {
  try {
    repair('poll');
  } catch (error) {
    log(`poll failed: ${error.message || error}`);
  }
}, POLL_MS).unref?.();

log(`watching ${CRITICAL_FILES.map((item) => item.posixPath).join(', ')} (debounce ${DEBOUNCE_MS}ms, poll ${POLL_MS}ms)`);

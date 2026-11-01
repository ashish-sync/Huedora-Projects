#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupProtectedSources, defaultBackupRoot } from './sourceFileProtection.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupRoot = defaultBackupRoot();
const results = backupProtectedSources(repoRoot, backupRoot);

console.log(`Protected-source backup root (outside workspace): ${backupRoot}`);
for (const item of results) {
  if (item.saved) {
    console.log(`  saved ${item.posixPath} (${item.bytes} bytes, ${item.gitHash})`);
  } else {
    console.error(`  skipped ${item.posixPath}: ${item.reason}`);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_FILES } from './sourceFileIntegrity.js';
import { restoreProtectedFile } from './sourceFileProtection.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requested = process.argv.slice(2).filter((arg) => arg !== '--');
const targets = requested.length ? requested : CRITICAL_FILES.map((item) => item.posixPath);

let failed = false;
for (const posixPath of targets) {
  const result = restoreProtectedFile(repoRoot, posixPath);
  if (result.restored) {
    console.log(`Restored ${result.posixPath} from ${result.from} (${result.bytes} bytes)`);
  } else {
    console.error(`Could not restore ${result.posixPath}: ${result.reason}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);

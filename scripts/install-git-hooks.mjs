#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repoRoot, '.githooks', 'pre-commit');
const gitDir = path.join(repoRoot, '.git');
const hooksDir = path.join(gitDir, 'hooks');
const target = path.join(hooksDir, 'pre-commit');

if (!existsSync(gitDir) || !existsSync(source)) {
  process.exit(0);
}

mkdirSync(hooksDir, { recursive: true });
copyFileSync(source, target);
console.log(`Installed ${path.relative(repoRoot, target)}`);

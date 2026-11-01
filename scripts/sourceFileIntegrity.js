export const SOURCE_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.html',
  '.scss',
  '.less',
]);

export const MIN_BYTES_FOR_SHRINK_CHECK = 5 * 1024;
export const MAX_RETAINED_RATIO = 0.5;
export const CRITICAL_FILES = Object.freeze([
  { posixPath: 'src/features/camps/campOps.css', minBytes: 200000 },
]);

const CRITICAL_PATHS = new Set(CRITICAL_FILES.map((item) => item.posixPath));

export function toPosixPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

export function isSourcePath(posixPath) {
  const normalized = toPosixPath(posixPath);
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot < 0) return false;
  return SOURCE_EXTENSIONS.has(normalized.slice(lastDot).toLowerCase());
}

export function isProtectedPath(filePath) {
  const normalized = toPosixPath(filePath);
  if (CRITICAL_PATHS.has(normalized)) return true;
  return CRITICAL_FILES.some((item) => (
    normalized.endsWith(`/${item.posixPath}`) || normalized.endsWith(`\\${item.posixPath}`)
  ));
}

export function evaluateFileIntegrity({
  posixPath,
  currentBytes,
  headBytes = null,
  backupBytes = null,
  criticalMinBytes = null,
  missing = false,
}) {
  const issues = [];
  const name = toPosixPath(posixPath);
  const baseline = Number.isFinite(headBytes) ? headBytes : backupBytes;

  if (missing || currentBytes == null) {
    issues.push({
      code: 'missing',
      posixPath: name,
      message: `${name}: protected source file is missing (deleted or unreadable)`,
    });
    return issues;
  }

  if (!Number.isFinite(currentBytes) || currentBytes < 0) {
    issues.push({
      code: 'unreadable',
      posixPath: name,
      message: `${name}: could not read file size`,
    });
    return issues;
  }

  if (currentBytes === 0) {
    issues.push({
      code: 'empty',
      posixPath: name,
      message: `${name}: zero-byte write or interrupted truncate-and-replace left 0 bytes`,
    });
  }

  if (Number.isFinite(criticalMinBytes) && currentBytes < criticalMinBytes) {
    issues.push({
      code: 'critical-too-small',
      posixPath: name,
      message: `${name}: ${currentBytes} bytes is below the required minimum of ${criticalMinBytes} bytes`,
    });
  }

  if (
    Number.isFinite(baseline)
    && baseline >= MIN_BYTES_FOR_SHRINK_CHECK
    && currentBytes < Math.ceil(baseline * MAX_RETAINED_RATIO)
  ) {
    const droppedPct = Math.round((1 - currentBytes / baseline) * 100);
    issues.push({
      code: 'major-shrink',
      posixPath: name,
      message: `${name}: unexpected truncation of ${droppedPct}% (${baseline} -> ${currentBytes} bytes)`,
    });
  }

  return issues;
}

export function recoveryProcedure(posixPath) {
  const name = toPosixPath(posixPath);
  return [
    `Identify: ${name} is damaged. Do not recreate it from memory.`,
    `Recover that one file only: node scripts/restore-protected-source.mjs -- ${name}`,
    `Or from Git: git checkout -- ${name}`,
    `Verify: npm run check:integrity -- --path ${name}`,
    'Do not include this file in Composer revert-all, git checkout -- ., or any full-file Write.',
    'Future styling changes must use a targeted StrReplace, then re-check the file size.',
  ];
}

export function formatIntegrityReport(issues) {
  const uniquePaths = [...new Set(issues.map((issue) => issue.posixPath).filter(Boolean))];
  const lines = [
    'SOURCE FILE PROTECTION: suspicious change blocked.',
    'Damaged file(s):',
    ...issues.map((issue) => `  - ${issue.message}`),
  ];

  for (const posixPath of uniquePaths) {
    lines.push('', `Recovery for ${posixPath}:`);
    for (const step of recoveryProcedure(posixPath)) {
      lines.push(`  ${step}`);
    }
  }

  return lines.join('\n');
}

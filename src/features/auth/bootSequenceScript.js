/**
 * Boot sequence script — timings tuned for ~35s total runtime.
 * @param {{ userName: string, designation: string, reportingManager: string }} vars
 */
export function buildBootSequence(vars) {
  const { userName, designation, reportingManager } = vars;

  return [
    { kind: 'type', text: 'TYLO ONE v3.0', charMs: 34 },
    { kind: 'type', text: '─'.repeat(40), charMs: 10 },
    { kind: 'pause', ms: 700 },
    { kind: 'type', text: 'Initializing Secure Environment...', charMs: 24 },
    { kind: 'progress', durationMs: 4200, width: 20 },
    { kind: 'pause', ms: 750 },
    { kind: 'type', text: 'Authenticating User...', charMs: 24 },
    { kind: 'pause', ms: 850 },
    { kind: 'type', text: '✓ Identity Verified', charMs: 22, className: 'boot-line--ok' },
    { kind: 'pause', ms: 780 },
    { kind: 'type', text: 'Loading Role Permissions...', charMs: 23 },
    { kind: 'pause', ms: 820 },
    { kind: 'type', text: `✓ ${designation}`, charMs: 20, className: 'boot-line--ok' },
    { kind: 'pause', ms: 760 },
    { kind: 'type', text: 'Syncing Camp Database...', charMs: 23 },
    { kind: 'pause', ms: 800 },
    { kind: 'type', text: '✓ Connected', charMs: 22, className: 'boot-line--ok' },
    { kind: 'pause', ms: 740 },
    { kind: 'type', text: 'Checking Device Registry...', charMs: 23 },
    { kind: 'pause', ms: 760 },
    { kind: 'type', text: '✓ Online', charMs: 22, className: 'boot-line--ok' },
    { kind: 'pause', ms: 740 },
    { kind: 'type', text: 'Informing Reporting Manager...', charMs: 22 },
    { kind: 'pause', ms: 850 },
    {
      kind: 'type',
      text: `✓ ${reportingManager} Notified`,
      charMs: 20,
      className: 'boot-line--ok',
    },
    { kind: 'pause', ms: 780 },
    { kind: 'type', text: 'Initializing Dashboard...', charMs: 23 },
    { kind: 'pause', ms: 820 },
    { kind: 'type', text: '✓ Complete', charMs: 22, className: 'boot-line--ok' },
    { kind: 'pause', ms: 950 },
    { kind: 'type', text: 'ACCESS GRANTED', charMs: 26, className: 'boot-line--granted' },
    { kind: 'pause', ms: 1100 },
    { kind: 'type', text: `Welcome, ${userName}.`, charMs: 28, className: 'boot-line--welcome' },
    { kind: 'pause', ms: 900 },
    { kind: 'type', text: 'Launching TYLO ONE......', charMs: 32, className: 'boot-line--launch' },
    { kind: 'pause', ms: 800 },
  ];
}

export function resolveBootVariables(user = {}) {
  const userName = String(user.fullName || user.username || user.email || 'Operator').trim();
  const designation =
    String(user.designation || '').trim() ||
    (user.roles || []).map((r) => r.name).filter(Boolean).join(', ') ||
    'Standard Access';
  const reportingManager =
    String(user.reportingManager?.fullName || '').trim() ||
    (user.reportingManagerId && typeof user.reportingManagerId === 'object'
      ? user.reportingManagerId.fullName
      : '') ||
    'Operations HQ';

  return { userName, designation, reportingManager };
}

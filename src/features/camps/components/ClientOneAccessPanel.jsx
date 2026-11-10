import { useEffect, useState } from 'react';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import { clientMasterApi } from '../campOpsApi.js';

const FEATURE_LABELS = [
  ['dashboard', 'Dashboard'],
  ['campTracker', 'Camp Tracker'],
  ['hcw', 'HCW Details'],
  ['calendar', 'Calendar'],
  ['invoices', 'Bills & Invoices'],
  ['annexures', 'Annexures'],
  ['mis', 'MIS Reports'],
  ['campRequestLink', 'Camp Request Link'],
  ['poUpload', 'Purchase Order Upload'],
];

const DEFAULT_FEATURES = Object.fromEntries(FEATURE_LABELS.map(([k]) => [k, true]));

export function ClientOneAccessPanel({
  recordId = '',
  persisted = false,
  programActive = true,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [access, setAccess] = useState(null);
  const [revealedPin, setRevealedPin] = useState('');
  const [rotateOpen, setRotateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [features, setFeatures] = useState(DEFAULT_FEATURES);

  async function refresh() {
    if (!persisted || !recordId) {
      setAccess(null);
      return;
    }
    try {
      const res = await clientMasterApi.getClientOneAccess(recordId);
      const data = res?.data ?? null;
      setAccess(data);
      setFeatures({ ...DEFAULT_FEATURES, ...(data?.features || {}) });
    } catch (err) {
      setError(err?.message || 'Could not load Client One access');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when record identity changes
  }, [persisted, recordId]);

  async function mint({ rotate = false } = {}) {
    if (!persisted || !recordId || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await clientMasterApi.mintClientOneAccess(recordId, { rotate });
      const data = res?.data || {};
      setAccess({
        accessId: data.accessId,
        path: data.path,
        sharedPath: data.sharedPath || '/client-one',
        url: data.url,
        deepUrl: data.deepUrl,
        isActive: true,
        features: data.features || features,
      });
      setFeatures({ ...DEFAULT_FEATURES, ...(data.features || features) });
      if (data.pin) setRevealedPin(data.pin);
    } catch (err) {
      setError(err?.message || 'Could not create Client One access');
    } finally {
      setBusy(false);
      setRotateOpen(false);
    }
  }

  async function revoke() {
    if (!persisted || !recordId || busy) return;
    setBusy(true);
    setError('');
    try {
      await clientMasterApi.revokeClientOneAccess(recordId);
      setAccess(null);
      setRevealedPin('');
      setFeatures(DEFAULT_FEATURES);
    } catch (err) {
      setError(err?.message || 'Could not revoke Client One access');
    } finally {
      setBusy(false);
      setRevokeOpen(false);
    }
  }

  async function saveFeatures(nextFeatures) {
    if (!persisted || !recordId || !access || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await clientMasterApi.updateClientOneAccess(recordId, { features: nextFeatures });
      const data = res?.data || {};
      setAccess((prev) => ({ ...prev, ...data }));
      setFeatures({ ...DEFAULT_FEATURES, ...(data.features || nextFeatures) });
    } catch (err) {
      setError(err?.message || 'Could not update portal permissions');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label, value) {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else window.prompt(`Copy ${label}`, value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      setError(`Could not copy ${label}`);
    }
  }

  const disabled = !persisted || !programActive || busy;
  const sharedUrl = access?.url
    || (typeof window !== 'undefined' ? `${window.location.origin}/client-one` : '/client-one');
  const deepUrl = access?.deepUrl
    || (access?.accessId && typeof window !== 'undefined'
      ? `${window.location.origin}/o/${access.accessId}`
      : '');

  return (
    <div className="program-camp-request-link" style={{ marginTop: 14 }}>
      <div className="program-camp-request-link__row">
        <div>
          <p className="program-camp-request-link__title">Client One access</p>
          <p className="meta-text program-camp-request-link__hint">
            {!persisted
              ? 'Save Program Configuration to issue a Client One PIN for this programme.'
              : !programActive
                ? 'Activate this program before sharing Client One access.'
                : 'Clients open the shared URL and enter the unique PIN. Configure which portal areas they can use below.'}
          </p>
        </div>
        <div className="program-camp-request-link__actions">
          {!access ? (
            <button
              type="button"
              className="btn secondary btn-compact"
              disabled={disabled}
              onClick={() => mint({ rotate: false })}
            >
              {busy ? 'Working…' : 'Generate PIN'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn secondary btn-compact"
                disabled={disabled}
                onClick={() => copyText('URL', sharedUrl)}
              >
                {copied === 'URL' ? 'URL copied' : 'Copy shared URL'}
              </button>
              {deepUrl ? (
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  disabled={disabled}
                  onClick={() => copyText('deep link', deepUrl)}
                >
                  {copied === 'deep link' ? 'Link copied' : 'Copy deep link'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn secondary btn-compact"
                disabled={disabled}
                onClick={() => setRotateOpen(true)}
              >
                Rotate PIN
              </button>
              <button
                type="button"
                className="btn danger btn-compact"
                disabled={disabled}
                onClick={() => setRevokeOpen(true)}
              >
                Revoke
              </button>
            </>
          )}
        </div>
      </div>

      {revealedPin ? (
        <p className="meta-text" style={{ marginTop: 10 }}>
          New PIN (shown once):
          {' '}
          <strong style={{ letterSpacing: '0.12em' }}>{revealedPin}</strong>
          {' '}
          <button
            type="button"
            className="btn ghost btn-compact"
            onClick={() => copyText('PIN', revealedPin)}
          >
            {copied === 'PIN' ? 'PIN copied' : 'Copy PIN'}
          </button>
        </p>
      ) : null}

      {access?.accessId ? (
        <p className="meta-text" style={{ marginTop: 8 }}>
          Access ID: <code className="mono-sm">{access.accessId}</code>
        </p>
      ) : null}

      {access ? (
        <div style={{ marginTop: 14 }}>
          <p className="program-camp-request-link__title" style={{ marginBottom: 8 }}>Portal permissions</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8,
            }}
          >
            {FEATURE_LABELS.map(([key, label]) => (
              <label key={key} className="meta-text" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={features[key] !== false}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = { ...features, [key]: e.target.checked };
                    setFeatures(next);
                    saveFeatures(next);
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <ConfirmDialog
        open={rotateOpen}
        title="Rotate Client One PIN?"
        message="This issues a new PIN and deep link. The previous PIN stops working immediately."
        confirmLabel="Rotate PIN"
        danger
        onCancel={() => setRotateOpen(false)}
        onConfirm={() => mint({ rotate: true })}
      />
      <ConfirmDialog
        open={revokeOpen}
        title="Revoke Client One access?"
        message="Clients will no longer be able to open this programme portal with the current PIN."
        confirmLabel="Revoke"
        danger
        onCancel={() => setRevokeOpen(false)}
        onConfirm={revoke}
      />
    </div>
  );
}

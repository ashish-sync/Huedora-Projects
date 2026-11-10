import { useEffect, useState } from 'react';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import { clientMasterApi } from '../campOpsApi.js';
import './programConfigPanels.css';

const FEATURE_LABELS = [
  ['dashboard', 'Dashboard'],
  ['campTracker', 'Camp Tracker'],
  ['invoices', 'Bills & Invoices'],
  ['mis', 'MIS Reports'],
  ['campRequestLink', 'Camp Request Link'],
  ['poUpload', 'Purchase Order Upload'],
];

const DEFAULT_FEATURES = Object.fromEntries(FEATURE_LABELS.map(([k]) => [k, true]));

/** campOpsApi wraps TYLO `{ data }` as axios-style `{ data: body }`. */
function unwrap(res) {
  return res?.data?.data !== undefined ? res.data.data : (res?.data ?? null);
}

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
  const [customPin, setCustomPin] = useState('');

  async function refresh() {
    if (!persisted || !recordId) {
      setAccess(null);
      return;
    }
    try {
      const data = unwrap(await clientMasterApi.getClientOneAccess(recordId));
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
    const trimmedCustom = customPin.replace(/\D+/g, '').slice(0, 6);
    if (trimmedCustom && trimmedCustom.length !== 6) {
      setError('Custom PIN must be exactly 6 digits, or leave blank to auto-generate.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = unwrap(await clientMasterApi.mintClientOneAccess(recordId, {
        rotate,
        pin: trimmedCustom || undefined,
      })) || {};
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
      if (data.pin) {
        setRevealedPin(String(data.pin));
        setCustomPin('');
        setRotateOpen(false);
      } else if (rotate) {
        setError('PIN was rotated but not returned. Try Rotate PIN again.');
        setRotateOpen(false);
      } else {
        setError('Access already exists. Use Rotate PIN to issue a new PIN (shown once).');
      }
    } catch (err) {
      setError(err?.message || 'Could not create Client One access');
      setRotateOpen(false);
    } finally {
      setBusy(false);
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
      const data = unwrap(await clientMasterApi.updateClientOneAccess(recordId, { features: nextFeatures })) || {};
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

  const hint = !persisted
    ? 'Save Program Configuration to issue a Client One PIN for this programme.'
    : !programActive
      ? 'Activate this program before sharing Client One access.'
      : 'Clients sign in with a 6-digit PIN. Leave blank to auto-generate, or enter your own. Shown once after Generate or Rotate.';

  return (
    <div className="program-config-panel" aria-label="Client One access">
      <div className="program-config-panel__head">
        <div>
          <p className="program-config-panel__title">Client One access</p>
          <p className="program-config-panel__hint">{hint}</p>
        </div>
        <div className="program-config-panel__actions">
          {!access?.accessId ? (
            <button
              type="button"
              className="btn secondary btn-compact"
              disabled={disabled}
              onClick={() => mint({ rotate: false })}
            >
              {busy ? 'Working…' : (customPin.length === 6 ? 'Set PIN' : 'Generate PIN')}
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

      {persisted && programActive ? (
        <div className="program-config-panel__body">
          <div className="program-config-panel__grid">
            <label className="program-config-field">
              <span>Set 6-digit PIN (optional)</span>
              <input
                className="field-input"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={customPin}
                disabled={disabled}
                placeholder="Auto"
                aria-label="Optional 6-digit Client One PIN"
                onChange={(e) => setCustomPin(e.target.value.replace(/\D+/g, '').slice(0, 6))}
              />
            </label>
            <div className="program-config-meta">
              {access?.accessId ? (
                <p>
                  Access ID: <code className="mono-sm">{access.accessId}</code>
                </p>
              ) : (
                <p>No access issued yet. Generate a PIN to create the portal link.</p>
              )}
              {access?.accessId && !revealedPin ? (
                <p>
                  PIN is hashed at rest. Use <strong>Rotate PIN</strong> to issue a new one (shown once).
                </p>
              ) : null}
            </div>
          </div>

          {revealedPin ? (
            <div className="program-config-pin-reveal" role="status">
              <p className="program-config-pin-reveal__label">New PIN — shown once</p>
              <p className="program-config-pin-reveal__value">{revealedPin}</p>
              <div className="program-config-pin-reveal__actions">
                <button
                  type="button"
                  className="btn primary btn-compact"
                  onClick={() => copyText('PIN', revealedPin)}
                >
                  {copied === 'PIN' ? 'PIN copied' : 'Copy PIN'}
                </button>
                <button
                  type="button"
                  className="btn ghost btn-compact"
                  onClick={() => setRevealedPin('')}
                >
                  Hide
                </button>
              </div>
              <p className="program-config-pin-reveal__note">
                There is no default PIN and it cannot be retrieved later. Use Rotate PIN if this one is lost.
              </p>
            </div>
          ) : null}

          {access?.accessId ? (
            <div className="program-config-permissions">
              <p className="program-config-permissions__title">Portal permissions</p>
              <div className="program-config-permissions__grid">
                {FEATURE_LABELS.map(([key, label]) => (
                  <label key={key} className="program-config-check">
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
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <ConfirmDialog
        open={rotateOpen}
        title="Rotate Client One PIN?"
        message={
          customPin.length === 6
            ? `This sets the PIN to ${customPin} and updates the deep link. The previous PIN stops working immediately.`
            : 'This issues a new auto-generated 6-digit PIN and deep link. The previous PIN stops working immediately. The new PIN is shown only once on this screen.'
        }
        confirmLabel={customPin.length === 6 ? 'Set new PIN' : 'Rotate PIN'}
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

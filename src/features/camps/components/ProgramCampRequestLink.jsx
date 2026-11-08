import { useState } from 'react';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import { clientMasterApi } from '../campOpsApi.js';

export function ProgramCampRequestLink({
  recordId = '',
  persisted = false,
  programActive = true,
  formMasterId = '',
  formMasterName = '',
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);

  async function copyLink({ replace = false } = {}) {
    if (!persisted || !recordId || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await clientMasterApi.mintRequestFormLink(recordId, { replace });
      const data = res?.data?.data || res?.data || {};
      const url = data.url
        || (data.path ? `${window.location.origin}${data.path}` : '')
        || (data.token ? `${window.location.origin}/c/${data.token}` : '');
      if (!url) {
        setError('Could not create the camp request form link');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt('Copy camp request form link', url);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err?.message || 'Could not create the camp request form link');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmReplace() {
    setReplaceOpen(false);
    await copyLink({ replace: true });
  }

  const disabled = !persisted || !programActive || busy;

  return (
    <div className="program-camp-request-link">
      <div className="program-camp-request-link__row">
        <div>
          <p className="program-camp-request-link__title">Camp Request Form</p>
          <p className="meta-text program-camp-request-link__hint">
            {!persisted
              ? 'Save Program Configuration to copy a shareable New Camp request form. Client, Division / Therapy, and Method stay locked to this program.'
              : !programActive
                ? 'Activate this program before sharing the camp request form.'
                : formMasterName || formMasterId
                  ? `Uses Form Master “${formMasterName || 'linked format'}”. Copy always returns this program’s final form link. Use Replace link only if you need a new URL.`
                  : 'Tip: link a Form Master format above for a configurable layout. Copy always returns this program’s final form link. Use Replace link only if you need a new URL.'}
          </p>
        </div>
        <div className="program-camp-request-link__actions">
          <button
            type="button"
            className="btn secondary btn-compact"
            disabled={disabled}
            onClick={() => copyLink({ replace: false })}
          >
            {busy ? 'Working…' : copied ? 'Link copied' : 'Copy camp request form link'}
          </button>
          {persisted && programActive ? (
            <button
              type="button"
              className="btn secondary btn-compact"
              disabled={disabled}
              onClick={() => setReplaceOpen(true)}
            >
              Replace link
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}

      <ConfirmDialog
        open={replaceOpen}
        title="Replace form link?"
        message="This creates a new final link for the program. The previous link will stop working."
        confirmLabel="Replace link"
        danger
        onCancel={() => setReplaceOpen(false)}
        onConfirm={handleConfirmReplace}
      />
    </div>
  );
}

import { useState } from 'react';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import { clientMasterApi } from '../campOpsApi.js';
import './programConfigPanels.css';

export function ProgramCampRequestLink({
  recordId = '',
  persisted = false,
  programActive = true,
  compact = false,
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

  const hint = !persisted
    ? 'Save Program Configuration to copy a shareable New Camp request form. Client, Division / Therapy, and Method stay locked to this program.'
    : !programActive
      ? 'Activate this program before sharing the camp request form.'
      : '';

  const actions = (
    <div className={compact ? 'client-master-program-camp-request__actions' : 'program-config-panel__actions'}>
      <button
        type="button"
        className="btn secondary btn-compact"
        disabled={disabled}
        onClick={() => copyLink({ replace: false })}
      >
        {busy ? 'Working…' : copied ? 'Link copied' : 'Copy form link'}
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
  );

  const dialog = (
    <ConfirmDialog
      open={replaceOpen}
      title="Replace form link?"
      message="This creates a new final link for the program. The previous link will stop working."
      confirmLabel="Replace link"
      danger
      onCancel={() => setReplaceOpen(false)}
      onConfirm={handleConfirmReplace}
    />
  );

  /* Compact: same label → control stack as Form Master selects in the 3-col row */
  if (compact) {
    return (
      <div className="client-master-program-camp-request__field" aria-label="Camp request form">
        <span className="client-master-program-camp-request__label">Camp request form</span>
        {actions}
        {hint ? <p className="program-config-panel__hint">{hint}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {dialog}
      </div>
    );
  }

  return (
    <div className="program-config-panel" aria-label="Camp request form">
      <div className="program-config-panel__head">
        <div>
          <p className="program-config-panel__title">Camp request form</p>
          {hint ? <p className="program-config-panel__hint">{hint}</p> : null}
        </div>
        {actions}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {dialog}
    </div>
  );
}

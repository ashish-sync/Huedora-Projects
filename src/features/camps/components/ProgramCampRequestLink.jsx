import { useState } from 'react';
import { clientMasterApi } from '../campOpsApi.js';

export function ProgramCampRequestLink({
  recordId = '',
  persisted = false,
  programActive = true,
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function handleCopy() {
    if (!persisted || !recordId || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await clientMasterApi.mintRequestFormLink(recordId);
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
                : 'Share this link so someone can submit a New Camp request for this program. Client, Division / Therapy, and Method stay locked. Copying a new link replaces the previous one.'}
          </p>
        </div>
        <button
          type="button"
          className="btn secondary btn-sm"
          disabled={disabled}
          onClick={handleCopy}
        >
          {busy ? 'Creating link…' : copied ? 'Link copied' : 'Copy camp request form link'}
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

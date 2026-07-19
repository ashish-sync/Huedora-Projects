import { useState } from 'react';
import { Link } from 'react-router-dom';

export function extractCreatedCamps(responseData) {
  const results = responseData?.results || [];
  const fromResults = results
    .filter((item) => item.status === 'created' && item.campId)
    .map((item) => ({ campId: item.campId, id: item.id || null }));

  if (fromResults.length) {
    return fromResults;
  }

  return (responseData?.campIds || []).map((campId) => ({ campId, id: null }));
}

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  }
}

export function CampCreatedBanner({ camps = [], onDismiss }) {
  const [copiedKey, setCopiedKey] = useState('');

  if (!camps.length) return null;

  async function handleCopyCampId(campId) {
    const didCopy = await copyText(campId);
    if (!didCopy) return;
    setCopiedKey(campId);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === campId ? '' : current));
    }, 1800);
  }

  async function handleCopyAll() {
    const allIds = camps.map((camp) => camp.campId).join('\n');
    const didCopy = await copyText(allIds);
    if (!didCopy) return;
    setCopiedKey('all');
    window.setTimeout(() => {
      setCopiedKey((current) => (current === 'all' ? '' : current));
    }, 1800);
  }

  return (
    <div className="camp-created-banner">
      <div className="camp-created-banner-header">
        <div>
          <strong>
            {camps.length === 1 ? 'Camp created' : `${camps.length} camps created`}
          </strong>
          <p className="camp-created-banner-copy">
            {camps.length === 1
              ? 'Copy the camp ID below or open it from Camps.'
              : 'Copy camp IDs below or open any camp from Camps using these IDs.'}
          </p>
        </div>
        <div className="camp-created-banner-actions">
          {camps.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm camp-created-copy-all-btn"
              onClick={handleCopyAll}
            >
              {copiedKey === 'all' ? 'Copied' : 'Copy all'}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              className="camp-created-dismiss"
              onClick={onDismiss}
              aria-label="Dismiss camp created notice"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <ul className="camp-created-list">
        {camps.map((camp) => (
          <li key={camp.campId} className="camp-created-item">
            {camp.id ? (
              <Link to={`/camps/manage/${camp.id}/edit`} className="camp-created-id-link">
                {camp.campId}
              </Link>
            ) : (
              <span className="camp-created-id">{camp.campId}</span>
            )}
            <button
              type="button"
              className="camp-created-copy-btn"
              onClick={() => handleCopyCampId(camp.campId)}
              aria-label={`Copy camp ID ${camp.campId}`}
              title="Copy camp ID"
            >
              {copiedKey === camp.campId ? 'Copied' : 'Copy'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

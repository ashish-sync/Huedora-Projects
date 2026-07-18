import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiUrl } from '../../shared/api.js';
import FilePicker from '../../components/ui/FilePicker.jsx';

const SENDER_ORG = 'Tylo Care';

function unavailableState(message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('expired')) return 'expired';
  if (text.includes('completed') || text.includes('used')) return 'used';
  if (text.includes('revoked') || text.includes('no longer active')) return 'revoked';
  return 'unavailable';
}

function stateFromContext(context) {
  const status = String(context?.status || '').toUpperCase();
  if (!status || status === 'PENDING') return 'ready';
  if (status === 'COMPLETED') return 'used';
  if (status === 'EXPIRED') return 'expired';
  if (status === 'REVOKED') {
    return context?.expiresAt && new Date(context.expiresAt).getTime() <= Date.now()
      ? 'expired'
      : 'revoked';
  }
  return 'unavailable';
}

export default function RequestProductUploadPage() {
  const { token } = useParams();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [state, setState] = useState('ready');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch(apiUrl(`/request-upload/${encodeURIComponent(token)}`))
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.error?.message || json?.message || 'This upload link is unavailable');
        }
        if (active) {
          setContext(json.data);
          setState(stateFromContext(json.data));
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setState(unavailableState(err.message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const pickPhoto = (file) => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file || null);
    setPreview(file ? URL.createObjectURL(file) : '');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!photo) {
      setError('Choose or take a product image before submitting.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('productPhoto', photo);
      const response = await fetch(apiUrl(`/request-upload/${encodeURIComponent(token)}`), {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error?.message || json?.message || 'Image upload failed');
      }
      setState('success');
      setPhoto(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.message);
      const nextState = unavailableState(err.message);
      if (nextState !== 'unavailable') setState(nextState);
    } finally {
      setBusy(false);
    }
  };

  const request = context?.request || context || {};

  if (loading) {
    return (
      <div className="sv-page">
        <main className="sv-main">
          <div className="sv-card">
            <p className="muted">Checking upload link…</p>
          </div>
        </main>
      </div>
    );
  }

  if (state !== 'ready') {
    const content = {
      success: ['Image uploaded', 'Thank you. The product image was attached to the request.'],
      expired: ['Link expired', 'This upload link has expired. Ask the requestor for a new link.'],
      used: ['Upload already completed', 'This single-use link has already been used.'],
      revoked: [
        'Link revoked',
        'This upload link is no longer active. Ask the requestor for a new link.',
      ],
      unavailable: ['Link unavailable', error || 'This upload link is not valid.'],
    }[state];
    return (
      <div className="sv-page">
        <header className="sv-header">
          <div>
            <strong>{SENDER_ORG}</strong>
            <span>Request product image</span>
          </div>
        </header>
        <main className="sv-main">
          <div className={`sv-card ${state === 'success' ? 'sv-success' : 'sv-error'}`}>
            <h1>{content[0]}</h1>
            <p>{content[1]}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <header className="sv-header">
        <div>
          <strong>{SENDER_ORG}</strong>
          <span>Request product image</span>
        </div>
        <span className="sv-badge">Secure link</span>
      </header>
      <main className="sv-main">
        <div className="sv-card">
          <h1>Upload product image</h1>
          <p className="muted">
            Take a clear photo of the product for this repair or maintenance request.
          </p>

          <div className="sv-asset-summary">
            <div>
              <span className="sv-label">Request</span>
              <strong>{request.requestNumber || '-'}</strong>
            </div>
            <div>
              <span className="sv-label">Asset</span>
              <strong>{request.assetName || request.asset?.name || '-'}</strong>
            </div>
            {(request.serialNumber ||
              request.asset?.serialNumber ||
              request.assetTag ||
              request.asset?.assetTag) && (
              <div>
                <span className="sv-label">
                  {request.serialNumber || request.asset?.serialNumber ? 'Serial' : 'Asset tag'}
                </span>
                <span className="mono-sm">
                  {request.serialNumber ||
                    request.asset?.serialNumber ||
                    request.assetTag ||
                    request.asset?.assetTag}
                </span>
              </div>
            )}
            {(request.custodianName || context?.custodian?.name) && (
              <div>
                <span className="sv-label">Custodian</span>
                <span>{request.custodianName || context?.custodian?.name}</span>
              </div>
            )}
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <form className="sv-form" onSubmit={submit}>
            <div className="field">
              <label>Product image *</label>
              <p className="muted vf-photo-hint">
                Keep the full product in frame and ensure damage or service concerns are visible.
              </p>
              <FilePicker
                ref={fileRef}
                accept="image/*"
                capture="environment"
                required
                onChange={(event) => pickPhoto(event.target.files?.[0] || null)}
              />
              {preview && (
                <img className="sv-photo-preview" src={preview} alt="Selected product preview" />
              )}
            </div>
            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? 'Uploading…' : 'Submit image'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

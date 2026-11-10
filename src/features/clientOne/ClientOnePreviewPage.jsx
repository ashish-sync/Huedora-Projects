import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { clientMasterApi } from '../camps/campOpsApi.js';
import { MODULE_PATH } from '../../shared/moduleRoutes.js';
import ClientOneApp from './ClientOneApp.jsx';
import { clearClientOneSession, readClientOneSession, setClientOneSession } from './clientOneSession.js';
import './clientOne.css';

/**
 * Staff preview entry — mint/reuse a preview session for the selected Client Master,
 * then render the same Client One portal shell with mode="preview".
 */
export default function ClientOnePreviewPage() {
  const { clientMasterId = '' } = useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function ensurePreviewSession() {
      setError('');
      const existing = readClientOneSession('preview');
      const matches = existing?.token
        && String(existing?.client?.clientMasterId || '') === String(clientMasterId);
      if (matches) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        clearClientOneSession('preview');
        const res = await clientMasterApi.previewClientOne(clientMasterId);
        const data = res?.data || {};
        if (!data.token) throw new Error('Preview session was not issued');
        setClientOneSession({
          token: data.token,
          expiresAt: data.expiresAt,
          client: data.client,
          features: data.features || data.client?.features,
          mode: 'preview',
        }, 'preview');
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not open Client One preview');
          setReady(false);
        }
      }
    }
    if (clientMasterId) ensurePreviewSession();
    return () => { cancelled = true; };
  }, [clientMasterId]);

  if (error) {
    return (
      <div className="page-shell client-one-hub">
        <div className="client-one-card">
          <h1>Client One preview</h1>
          <p className="error-text">{error}</p>
          <Link className="btn secondary btn-compact" to={MODULE_PATH.CLIENT_ONE}>
            Back to Client One hub
          </Link>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="page-shell client-one-hub">
        <div className="client-one-card">
          <p className="meta-text">Opening programme preview…</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOneApp
      mode="preview"
      onExitPreview={() => {
        clearClientOneSession('preview');
        navigate(MODULE_PATH.CLIENT_ONE);
      }}
    />
  );
}

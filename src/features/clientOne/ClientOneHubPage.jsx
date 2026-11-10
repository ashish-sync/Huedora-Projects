import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { clientMasterApi } from '../camps/campOpsApi.js';
import { MODULE_PATH } from '../../shared/moduleRoutes.js';
import { setClientOneSession, clearClientOneSession } from './clientOneSession.js';
import './clientOne.css';

function programmeLabel(row) {
  const parts = [
    row.clientName,
    row.programName || row.drugTherapyName,
    row.campName,
  ].filter(Boolean);
  return parts.join(' · ') || 'Programme';
}

export default function ClientOneHubPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError('');
    clientMasterApi.list({ page: 1, limit: 200, isActive: true })
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.data || res?.data || [];
        setRows(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load programmes');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const hay = [
        row.clientName,
        row.programName,
        row.drugTherapyName,
        row.campName,
        row.clientCode,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  async function openPreview(row) {
    if (!row?._id || openingId) return;
    setOpeningId(row._id);
    setError('');
    try {
      clearClientOneSession('preview');
      const res = await clientMasterApi.previewClientOne(row._id);
      const data = res?.data || {};
      if (!data.token) throw new Error('Preview session was not issued');
      setClientOneSession({
        token: data.token,
        expiresAt: data.expiresAt,
        client: data.client,
        features: data.features || data.client?.features,
        mode: 'preview',
      }, 'preview');
      navigate(`/client-one/preview/${encodeURIComponent(row._id)}`);
    } catch (err) {
      setError(err?.message || 'Could not open Client One preview');
    } finally {
      setOpeningId('');
    }
  }

  return (
    <div className="page-shell client-one-hub">
      <header className="page-header">
        <div>
          <h1>Client One</h1>
          <p className="meta-text">
            Internal staff hub — select a programme to preview the client portal.
            External clients continue to use the shared URL and PIN.
          </p>
        </div>
      </header>

      <section className="client-one-card">
        <div className="client-one-toolbar">
          <label style={{ flex: 1, minWidth: 220 }}>
            <span>Find programme</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Client, division, method…"
              aria-label="Find programme"
            />
          </label>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-wrap">
          <table className="client-one-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Division / Therapy</th>
                <th>Method</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row._id}>
                  <td>{row.clientName || '—'}</td>
                  <td>{row.programName || row.drugTherapyName || '—'}</td>
                  <td>{row.campName || '—'}</td>
                  <td>{row.isActive === false ? 'Inactive' : 'Active'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button
                        type="button"
                        disabled={Boolean(openingId) || row.isActive === false}
                        onClick={() => openPreview(row)}
                      >
                        {openingId === row._id ? 'Opening…' : 'Preview portal'}
                      </Button>
                      <Link
                        className="btn secondary btn-compact"
                        to={`${MODULE_PATH.MASTER_ONE}/client-masters/${row._id}/edit`}
                        title={programmeLabel(row)}
                      >
                        Configure
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && !busy ? (
                <tr>
                  <td colSpan={5}>No programmes match this search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {busy ? <p className="meta-text">Loading programmes…</p> : null}
      </section>

      <section className="client-one-card" style={{ marginTop: 14 }}>
        <h2 className="client-one-section-title">External client access</h2>
        <p className="meta-text">
          Clients open <code>/client-one</code> (or their deep link) and enter the programme PIN.
          Mint and manage PINs from Client Master → Program Configuration → Client One access.
        </p>
      </section>
    </div>
  );
}

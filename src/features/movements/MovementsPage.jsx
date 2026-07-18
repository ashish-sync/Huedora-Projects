import { useEffect, useState } from 'react';
import { api, downloadExcel } from '../../shared/api.js';
import { FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';

export default function MovementsPage() {
  const { can, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ assetId: '', toContactId: '', reason: '', city: '' });
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  const load = () => api('/movements').then((r) => setRows(r.data)).catch((e) => setError(e.message));

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/movements/export', 'Movements.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    load();
    api('/assets?limit=200').then((r) => setAssets(r.data)).catch(() => {});
    api('/contacts?limit=200').then((r) => setContacts(r.data || [])).catch(() => {});
  }, []);

  const act = async (id, action) => {
    try {
      await api(`/movements/${id}/${action}`, { method: 'POST', body: {} });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const pending = rows.filter((m) => m.status === 'REQUESTED').length;

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: 'Movements' }]}
      title="Asset movements"
      description="Request, approve, ship, and receive asset transfers. You cannot approve your own request."
      actions={
        <button
          className="btn secondary"
          type="button"
          disabled={exportBusy}
          onClick={downloadMaster}
        >
          {exportBusy ? 'Downloading…' : 'Download Excel'}
        </button>
      }
      kpis={[
        { label: 'Total requests', value: rows.length },
        { label: 'Pending approval', value: pending },
      ]}
    >
      {error && <p className="error">{error}</p>}

      {can('movements:request') && (
        <form
          className="card"
          style={{ padding: 20, marginBottom: 16 }}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/movements', {
                method: 'POST',
                body: {
                  assetIds: [form.assetId],
                  reason: form.reason,
                  to: {
                    contactId: form.toContactId || undefined,
                    location: { city: form.city || undefined },
                  },
                },
              });
              load();
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Request movement</h3>
          <div className="row">
            <div className="field">
              <label>Asset</label>
              <AdaptiveSelect required value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
                <option value="">Select</option>
                {assets.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.assetTag}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>To {FIELD.CUSTODIAN}</label>
              <AdaptiveSelect value={form.toContactId} onChange={(e) => setForm({ ...form, toContactId: e.target.value })}>
                <option value="">-</option>
                {contacts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.city ? `: ${c.city}` : ''}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>To city</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="field">
              <label>Reason</label>
              <input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <button className="btn" type="submit">
            Submit request
          </button>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Status</th>
              <th>Requestor</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m._id}>
                <td>{m.movementNumber}</td>
                <td>
                  <span className="badge tone-neutral">{m.status}</span>
                </td>
                <td>{m.requestorId?.fullName || '-'}</td>
                <td>{m.reason}</td>
                <td className="row">
                  {can('movements:approve') &&
                    m.status === 'REQUESTED' &&
                    String(m.requestorId?._id || m.requestorId) !== String(user.id) && (
                      <>
                        <button className="btn btn-compact" type="button" onClick={() => act(m._id, 'approve')}>
                          Approve
                        </button>
                        <button className="btn secondary btn-compact" type="button" onClick={() => act(m._id, 'reject')}>
                          Reject
                        </button>
                      </>
                    )}
                  {can('movements:request') && m.status === 'APPROVED' && (
                    <button className="btn secondary btn-compact" type="button" onClick={() => act(m._id, 'ship')}>
                      Ship
                    </button>
                  )}
                  {can('movements:request') && m.status === 'IN_TRANSIT' && (
                    <button className="btn btn-compact" type="button" onClick={() => act(m._id, 'receive')}>
                      Receive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

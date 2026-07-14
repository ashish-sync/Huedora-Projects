import { useEffect, useState } from 'react';
import { api, downloadExcel } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

export default function RepairsPage() {
  const { can } = useAuth();
  const [repairs, setRepairs] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [assets, setAssets] = useState([]);
  const [fault, setFault] = useState({ assetId: '', faultDescription: '', priority: 'MEDIUM' });
  const [mnt, setMnt] = useState({ assetId: '', description: '', maintenanceType: 'PM' });
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  const load = async () => {
    const [r, m] = await Promise.all([api('/repairs'), api('/maintenance')]);
    setRepairs(r.data);
    setMaintenance(m.data);
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/repairs/export', 'Repairs.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api('/assets?limit=200').then((x) => setAssets(x.data)).catch(() => {});
  }, []);

  const openRepairs = repairs.filter((t) => t.status !== 'CLOSED').length;

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: 'Repairs & maintenance' }]}
      title="Repairs & maintenance"
      description="Separate lifecycle states for corrective repairs and preventive maintenance."
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
        { label: 'Open repairs', value: openRepairs },
        { label: 'Maintenance orders', value: maintenance.length },
      ]}
    >
      {error && <p className="error">{error}</p>}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        {can('repairs:write') && (
          <form
            className="card"
            style={{ padding: 20 }}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/repairs', { method: 'POST', body: fault });
                load();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Open repair</h3>
            <div className="field">
              <label>Asset</label>
              <select required value={fault.assetId} onChange={(e) => setFault({ ...fault, assetId: e.target.value })}>
                <option value="">Select</option>
                {assets.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.assetTag} ({a.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Fault</label>
              <textarea required value={fault.faultDescription} onChange={(e) => setFault({ ...fault, faultDescription: e.target.value })} />
            </div>
            <button className="btn" type="submit">
              Open ticket
            </button>
          </form>
        )}

        {can('maintenance:write') && (
          <form
            className="card"
            style={{ padding: 20 }}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/maintenance', { method: 'POST', body: mnt });
                load();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Start maintenance</h3>
            <div className="field">
              <label>Asset</label>
              <select required value={mnt.assetId} onChange={(e) => setMnt({ ...mnt, assetId: e.target.value })}>
                <option value="">Select</option>
                {assets.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.assetTag} ({a.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Description</label>
              <input value={mnt.description} onChange={(e) => setMnt({ ...mnt, description: e.target.value })} />
            </div>
            <button className="btn" type="submit">
              Start
            </button>
          </form>
        )}
      </div>

      <div className="card table-wrap" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', padding: '16px 16px 0', fontSize: '1rem' }}>Repair tickets</h3>
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Asset</th>
              <th>Status</th>
              <th>Fault</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {repairs.map((t) => (
              <tr key={t._id}>
                <td>{t.ticketNumber}</td>
                <td>{t.assetId?.assetTag || '—'}</td>
                <td>
                  <span className="badge tone-neutral">{t.status}</span>
                </td>
                <td>{t.faultDescription}</td>
                <td>
                  {can('repairs:write') && t.status !== 'CLOSED' && (
                    <button
                      className="btn secondary btn-compact"
                      type="button"
                      onClick={() =>
                        api(`/repairs/${t._id}/status`, {
                          method: 'POST',
                          body: { status: 'CLOSED', disposition: 'REPAIRED', returnToStatus: 'Warehouse' },
                        })
                          .then(load)
                          .catch((e) => setError(e.message))
                      }
                    >
                      Close → Warehouse
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h3 style={{ margin: '0 0 12px', padding: '16px 16px 0', fontSize: '1rem' }}>Maintenance orders</h3>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Asset</th>
              <th>Status</th>
              <th>Type</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {maintenance.map((o) => (
              <tr key={o._id}>
                <td>{o.orderNumber}</td>
                <td>{o.assetId?.assetTag || '—'}</td>
                <td>
                  <span className="badge tone-neutral">{o.status}</span>
                </td>
                <td>{o.maintenanceType}</td>
                <td>
                  {can('maintenance:write') && o.status !== 'COMPLETED' && (
                    <button
                      className="btn secondary btn-compact"
                      type="button"
                      onClick={() =>
                        api(`/maintenance/${o._id}/status`, {
                          method: 'POST',
                          body: { status: 'COMPLETED', returnToStatus: 'Available' },
                        })
                          .then(load)
                          .catch((e) => setError(e.message))
                      }
                    >
                      Complete
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

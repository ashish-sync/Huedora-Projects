import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { MODULE, FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';

export default function AssetDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [asset, setAsset] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [toStatus, setToStatus] = useState('');
  const [contactId, setContactId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [a, t] = await Promise.all([api(`/assets/${id}`), api(`/assets/${id}/timeline`)]);
    setAsset(a.data);
    setTimeline(t.data);
    setContactId(a.data?.contactId?._id || a.data?.contactId || '');
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api('/contacts?limit=200')
      .then((r) => setContacts(r.data || []))
      .catch(() => {});
  }, [id]);

  const transition = async (e) => {
    e.preventDefault();
    try {
      await api(`/assets/${id}/transitions`, {
        method: 'POST',
        body: { toStatus, reason, contactId: contactId || undefined },
      });
      await load();
      setReason('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!asset) return <p className="muted">{error || 'Loading…'}</p>;

  const custodian = asset.contactId?.name || '-';

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            <Link to="/asset-inventory">{MODULE.ASSET_INVENTORY}</Link> / {asset.assetTag}
          </p>
          <h2 style={{ margin: '0.25rem 0 0' }}>{asset.deviceNameSnapshot}</h2>
        </div>
        <span className="badge">{asset.status}</span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Details</h3>
          <table>
            <tbody>
              <tr>
                <td>QR</td>
                <td>
                  <code>{asset.qrCode}</code>
                </td>
              </tr>
              <tr>
                <td>Serial</td>
                <td>{asset.serialNumber || '-'}</td>
              </tr>
              <tr>
                <td>Qty</td>
                <td>{asset.quantity}</td>
              </tr>
              <tr>
                <td>{FIELD.CUSTODIAN}</td>
                <td>{custodian}</td>
              </tr>
              <tr>
                <td>Location</td>
                <td>
                  {[asset.location?.city, asset.location?.zone, asset.location?.currentLocation]
                    .filter(Boolean)
                    .join(' / ') || '-'}
                </td>
              </tr>
              <tr>
                <td>Agreement status</td>
                <td>{asset.agreementStatus || '-'}</td>
              </tr>
              <tr>
                <td>Custody</td>
                <td>{asset.custody || '-'}</td>
              </tr>
              <tr>
                <td>Added month</td>
                <td>{asset.addedMonth || '-'}</td>
              </tr>
              <tr>
                <td>Remarks</td>
                <td>{asset.remarks || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          {can('assets:transition') && (
            <form onSubmit={transition}>
              <h3 style={{ marginTop: 0 }}>Lifecycle transition</h3>
              <div className="field">
                <label>To status</label>
                <AdaptiveSelect required value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
                  <option value="">Select</option>
                  {[
                    'Received',
                    'Warehouse',
                    'Available',
                    'Assigned',
                    'Verified',
                    'Maintenance',
                    'Repair',
                    'Retired',
                    'Disposed',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
              <div className="field">
                <label>{FIELD.CUSTODIAN} (for Assigned/Verified)</label>
                <AdaptiveSelect value={contactId} onChange={(e) => setContactId(e.target.value)}>
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
                <label>Reason</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <button className="btn" type="submit">
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Timeline</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Event</th>
              <th>From → To</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((ev) => (
              <tr key={ev._id}>
                <td>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '-'}</td>
                <td>{ev.eventType}</td>
                <td>
                  {ev.fromStatus || '-'} → {ev.toStatus || '-'}
                </td>
                <td>{ev.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

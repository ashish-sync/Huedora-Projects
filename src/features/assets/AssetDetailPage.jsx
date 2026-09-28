import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import { MODULE, FIELD } from '../../shared/labels.js';

function assetStatusTone(status) {
  const s = String(status || '');
  if (s === 'Agreement Signed' || s === 'Active') return 'ok';
  if (['Tylo Office', 'Under Repairs'].includes(s)) return 'info';
  if (['Lost/Stolen', 'Untraceable', 'End of Life'].includes(s)) return 'danger';
  if (s === 'Not Initiated') return 'neutral';
  return 'warn';
}

const EVENT_LABELS = {
  ASSET_CREATED: 'Created',
  FIELD_UPDATE: 'Edited',
  STATUS_TRANSITION: 'Status change',
  CUSTODY_CHANGE: 'Custody / transfer',
  AGREEMENT_LINK: 'Agreement linked',
  AGREEMENT_UPLOADED: 'Agreement uploaded',
  AGREEMENT_ACTIVATED: 'Agreement activated',
  REPAIR: 'Repair',
  MAINTENANCE: 'Maintenance',
  MOVEMENT: 'Movement',
};

function isCreateEvent(ev) {
  const type = String(ev.eventType || ev.type || '');
  const reason = String(ev.reason || ev.message || '').toLowerCase();
  return (
    type === 'ASSET_CREATED' ||
    reason.includes('asset created') ||
    reason.includes('asset registered')
  );
}

function eventLabel(ev) {
  if (isCreateEvent(ev)) return 'Created';
  const raw = String(ev.eventType || ev.type || '').trim();
  if (!raw) return 'Activity';
  return (
    EVENT_LABELS[raw] ||
    raw
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

function eventWhen(ev) {
  return ev.at || ev.createdAt || '';
}

function eventChange(ev) {
  if (isCreateEvent(ev)) return '—';
  const kind = String(ev.eventType || ev.type || '');
  if (kind === 'CUSTODY_CHANGE' && (ev.fromCustody || ev.toCustody)) {
    return `${ev.fromCustody || '—'} → ${ev.toCustody || '—'}`;
  }
  const from = ev.fromStatus || '';
  const to = ev.toStatus || '';
  if (from || to) return `${from || '—'} → ${to || '—'}`;
  if (ev.message && ev.message !== ev.reason) return ev.message;
  return '—';
}

function eventDetail(ev) {
  if (isCreateEvent(ev)) return 'Asset registered';
  return ev.reason || ev.message || '—';
}

function personName(person) {
  if (!person) return '';
  if (typeof person === 'string') return person;
  return person.fullName || person.name || person.email || '';
}

function eventActor(ev, asset) {
  const direct =
    ev.actorName ||
    personName(ev.actorId) ||
    ev.actorEmail ||
    '';
  if (direct) return direct;
  if (isCreateEvent(ev)) {
    return personName(asset?.createdBy) || personName(asset?.updatedBy) || '—';
  }
  return '—';
}

function locationLabel(asset) {
  return (
    [asset.location?.city, asset.location?.zone, asset.location?.currentLocation]
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

export default function AssetDetailPage() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api(`/assets/${id}`), api(`/assets/${id}/timeline`)])
      .then(([a, t]) => {
        setAsset(a.data);
        setTimeline(t.data || []);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (!asset) return <p className="muted">{error || 'Loading…'}</p>;

  const custodian = asset.contactId?.name || asset.custodianName || '—';
  const displayStatus = asset.agreementStatus || 'Not Initiated';
  const rows = [
    { label: 'QR', value: asset.qrCode || '—', mono: Boolean(asset.qrCode) },
    { label: 'Serial', value: asset.serialNumber || '—' },
    { label: FIELD.ASSET_CUSTODY, value: asset.custody || '—' },
    { label: FIELD.CUSTODIAN, value: custodian },
    { label: 'Location', value: locationLabel(asset) },
    { label: 'Added', value: asset.addedMonth || '—' },
  ];
  if (asset.remarks) rows.push({ label: 'Remarks', value: asset.remarks });

  return (
    <div className="asset-detail-page">
      <div className="asset-detail-topbar">
        <div className="asset-detail-heading">
          <p className="muted asset-detail-crumb">
            <Link to="/asset-one">{MODULE.ASSET_INVENTORY}</Link>
            <span aria-hidden="true"> / </span>
            {asset.assetTag}
          </p>
          <div className="asset-detail-title-row">
            <h2 className="asset-detail-title">{asset.deviceNameSnapshot}</h2>
            <span className={`badge tone-${assetStatusTone(displayStatus)}`}>{displayStatus}</span>
          </div>
        </div>
        <Link className="btn secondary btn-compact" to="/asset-one">
          Back to register
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="asset-detail-grid">
        <section className="card asset-detail-card">
          <h3 className="asset-detail-card-title">Details</h3>
          <div className="asset-detail-facts" role="list">
            {rows.map((row) => (
              <div key={row.label} className="asset-detail-fact" role="listitem">
                <span className="asset-detail-fact-label">{row.label}</span>
                <span className="asset-detail-fact-value">
                  {row.mono ? <code>{row.value}</code> : row.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card asset-detail-card asset-detail-audit">
          <h3 className="asset-detail-card-title">Audit trail</h3>
          <p className="muted asset-detail-hint">
            Who changed this asset — edits, custody, agreements, repairs, and transfers.
          </p>
          <div className="asset-detail-audit-wrap">
            <table className="asset-detail-audit-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">By</th>
                  <th scope="col">What</th>
                  <th scope="col">Change</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {timeline.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  timeline.map((ev) => (
                    <tr key={ev._id}>
                      <td>{eventWhen(ev) ? formatDateTime(eventWhen(ev)) : '—'}</td>
                      <td>{eventActor(ev, asset)}</td>
                      <td>{eventLabel(ev)}</td>
                      <td>{eventChange(ev)}</td>
                      <td>{eventDetail(ev)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

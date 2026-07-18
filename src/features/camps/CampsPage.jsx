import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { MODULE } from '../../shared/labels.js';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import { isApprovalOverdue } from '../../shared/approvalTiming.js';

const FALLBACK_MAP = [
  { method: 'Diagnostic', process: 'NT PRO - BNP', campType: 'Non Device' },
  { method: 'Diagnostic', process: 'Lipidocare', campType: 'Device' },
  { method: 'Diagnostic', process: 'Vitamin D3', campType: 'Device' },
  { method: 'Physio & Neuro', process: 'Neuro', campType: 'Device' },
  { method: 'BMD', process: 'BMD', campType: 'Device' },
  { method: 'Uroflow', process: 'Uroflow', campType: 'Device' },
  { method: 'Dietitian', process: 'Dietitian', campType: 'Non Device' },
];

function resolveSlot(startTime) {
  if (!startTime) return '';
  const m = String(startTime).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const mins = Number(m[1]) * 60 + Number(m[2]);
  if (mins >= 360 && mins <= 779) return 'Morning';
  if (mins >= 780 && mins <= 1019) return 'Noon';
  if (mins >= 1020 && mins <= 1320) return 'Evening';
  return '';
}

/** Earliest allowed camp date: today + 2 calendar days (YYYY-MM-DD) */
function minCampDateStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyForm() {
  return {
    method: 'Diagnostic',
    process: 'NT PRO - BNP',
    campType: 'Non Device',
    doctorName: '',
    address: '',
    city: '',
    state: '',
    campDate: '',
    startTime: '09:00',
    endTime: '12:00',
    campSlot: 'Morning',
    technicianContactId: '',
    technicianName: '',
    technicianNumber: '',
    remarks: '',
  };
}

function statusTone(status) {
  if (status === 'Approved') return 'tone-ok';
  if (status === 'Declined') return 'tone-warn';
  return 'tone-neutral';
}

export default function CampsPage() {
  const { can, user } = useAuth();
  const canRequest = can('camps:request') || can('camps:approve') || can('*');
  const canApprove = can('camps:approve') || can('*');
  const allowed = can('camps:read') || canRequest || canApprove;

  const [meta, setMeta] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState(canApprove ? 'all' : 'mine');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [decideId, setDecideId] = useState('');
  const [decideAction, setDecideAction] = useState('Approve');
  const [decideReason, setDecideReason] = useState('');
  const [decideHcwContactId, setDecideHcwContactId] = useState('');
  const [decideHcwName, setDecideHcwName] = useState('');
  const [decideHcwNumber, setDecideHcwNumber] = useState('');
  const minCampDate = useMemo(() => minCampDateStr(), []);

  const processMap = meta?.processMap || FALLBACK_MAP;
  const methods = meta?.methods || [...new Set(processMap.map((r) => r.method))];

  const processes = useMemo(
    () => processMap.filter((r) => r.method === form.method).map((r) => r.process),
    [processMap, form.method]
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (statusFilter) params.set('status', statusFilter);
      if (q.trim()) params.set('q', q.trim());
      if (view === 'mine') params.set('mine', '1');
      const res = await api(`/camps?${params}`);
      setRows(res.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [statusFilter, q, view]);

  useEffect(() => {
    api('/camps/meta')
      .then((r) => setMeta(r.data))
      .catch(() => {});
    api('/contacts?limit=500')
      .then((r) => setContacts(r.data || []))
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onMethodChange = (method) => {
    const first = processMap.find((r) => r.method === method);
    setForm((f) => ({
      ...f,
      method,
      process: first?.process || '',
      campType: first?.campType || '',
    }));
  };

  const onProcessChange = (process) => {
    const row = processMap.find((r) => r.method === form.method && r.process === process);
    setForm((f) => ({
      ...f,
      process,
      campType: row?.campType || '',
    }));
  };

  const onStartTimeChange = (startTime) => {
    setForm((f) => ({
      ...f,
      startTime,
      campSlot: resolveSlot(startTime),
    }));
  };

  const pickTechnician = (contactId) => {
    const c = contacts.find((x) => x._id === contactId);
    if (!c) {
      setDecideHcwContactId('');
      setDecideHcwName('');
      setDecideHcwNumber('');
      return;
    }
    setDecideHcwContactId(c._id);
    setDecideHcwName(c.name || '');
    setDecideHcwNumber(c.contact || c.mobile || '');
  };

  const openCreate = () => {
    const base = emptyForm();
    const first = processMap.find((r) => r.method === base.method) || processMap[0];
    if (first) {
      base.method = first.method;
      base.process = first.process;
      base.campType = first.campType;
    }
    base.campSlot = resolveSlot(base.startTime);
    setForm(base);
    setFormOpen(true);
    setMsg('');
    setError('');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canRequest) return;
    if (!form.campDate || form.campDate < minCampDate) {
      setError(`Camp Date must be on or after ${minCampDate}.`);
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const { technicianContactId, technicianName, technicianNumber, ...rest } = form;
      await api('/camps', { method: 'POST', body: rest });
      setMsg('Camp request submitted. Awaiting approval.');
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resetDecide = () => {
    setDecideId('');
    setDecideReason('');
    setDecideHcwContactId('');
    setDecideHcwName('');
    setDecideHcwNumber('');
  };

  const submitDecision = async (e) => {
    e.preventDefault();
    if (!canApprove || !decideId) return;
    setBusy(true);
    setError('');
    try {
      const body = { decision: decideAction };
      if (decideAction === 'Decline') {
        body.reason = decideReason;
      } else {
        body.technicianName = decideHcwName;
        body.technicianNumber = decideHcwNumber;
        body.technicianContactId = decideHcwContactId || null;
        body.hcwName = decideHcwName;
        body.hcwNumber = decideHcwNumber;
        if (decideReason.trim()) body.reason = decideReason;
      }
      await api(`/camps/${decideId}/decide`, { method: 'POST', body });
      setMsg(
        decideAction === 'Approve'
          ? 'Request approved with HCW assigned.'
          : 'Request declined.'
      );
      resetDecide();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.CAMP_MANAGEMENT }]}
        title={MODULE.CAMP_MANAGEMENT}
      >
        <p className="muted">You do not have access to {MODULE.CAMP_MANAGEMENT}.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.CAMP_MANAGEMENT }]}
      title={MODULE.CAMP_MANAGEMENT}
      description="Submitters create camp requests. Approvers assign an HCW or decline with a reason."
    >
      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="inv-toolbar logistics-toolbar">
        {canApprove && (
          <AdaptiveSelect value={view} onChange={(e) => setView(e.target.value)}>
            <option value="all">All requests</option>
            <option value="mine">My requests</option>
          </AdaptiveSelect>
        )}
        <AdaptiveSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Declined">Declined</option>
        </AdaptiveSelect>
        <input
          className="esign-search inv-search"
          placeholder="Search doctor, technician, city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn secondary" type="button" onClick={load}>
          Search
        </button>
        {canRequest && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (formOpen) {
                setFormOpen(false);
                return;
              }
              openCreate();
            }}
          >
            {formOpen ? 'Close form' : '+ New camp request'}
          </button>
        )}
      </div>

      {canRequest && formOpen && (
        <form className="card logistics-form" onSubmit={save}>
          <h3>Camp Request</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Request Date &amp; Time is captured on submit. Default status is Pending. Camp Type and
            Camp Slot fill automatically. Technician / HCW is assigned by the approver later.
          </p>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <div className="field">
              <label>Method *</label>
              <AdaptiveSelect required value={form.method} onChange={(e) => onMethodChange(e.target.value)}>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>Process *</label>
              <AdaptiveSelect
                required
                value={form.process}
                onChange={(e) => onProcessChange(e.target.value)}
              >
                {processes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>Camp Type (Auto)</label>
              <input readOnly className="is-readonly" value={form.campType} />
            </div>
            <div className="field">
              <label>Doctor Name *</label>
              <input
                required
                value={form.doctorName}
                onChange={(e) => setField('doctorName', e.target.value)}
              />
            </div>
            <div className="field am-form-span">
              <label>Address</label>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </div>
            <div className="field am-form-span">
              <LocationCascade
                showPin={false}
                value={{
                  state: form.state,
                  city: form.city,
                  district: form.district || '',
                  stateId: form.stateId || '',
                  districtId: form.districtId || '',
                  cityId: form.cityId || '',
                }}
                onChange={(loc) => {
                  setField('state', loc.state || '');
                  setField('city', loc.city || '');
                  setField('district', loc.district || '');
                  setField('stateId', loc.stateId || '');
                  setField('districtId', loc.districtId || '');
                  setField('cityId', loc.cityId || '');
                }}
              />
            </div>
            <div className="field">
              <label>Camp Date *</label>
              <input
                type="date"
                required
                min={minCampDate}
                value={form.campDate}
                onChange={(e) => setField('campDate', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Start Time *</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
              />
            </div>
            <div className="field">
              <label>End Time *</label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setField('endTime', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Camp Slot (Auto)</label>
              <input
                readOnly
                className="is-readonly"
                value={form.campSlot || '-'}
                placeholder="Derived from Start Time"
              />
            </div>
            <div className="field am-form-span">
              <label>Remarks</label>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setField('remarks', e.target.value)}
              />
            </div>
          </div>
          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy || !form.campSlot}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
            <button className="btn secondary" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {decideId && canApprove && (
        <form className="card logistics-form" onSubmit={submitDecision}>
          <h3>{decideAction} camp request</h3>
          {decideAction === 'Approve' ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Assign Technician (HCW) name and number to approve.
              </p>
              <div className="logistics-form-grid logistics-form-grid--inout">
                <div className="field">
                  <label>Technician Name (HCW Name) *</label>
                  <AdaptiveSelect
                    required
                    value={decideHcwContactId}
                    onChange={(e) => pickTechnician(e.target.value)}
                  >
                    <option value="">Select from Contact Directory…</option>
                    {contacts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {c.city ? ` · ${c.city}` : ''}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>HCW Name *</label>
                  <input
                    required
                    value={decideHcwName}
                    onChange={(e) => setDecideHcwName(e.target.value)}
                    placeholder="Or type HCW name"
                  />
                </div>
                <div className="field">
                  <label>Technician Number *</label>
                  <input
                    required
                    value={decideHcwNumber}
                    onChange={(e) => setDecideHcwNumber(e.target.value)}
                    placeholder="Auto from contact, or enter number"
                  />
                </div>
                <div className="field am-form-span">
                  <label>Notes (optional)</label>
                  <textarea
                    rows={2}
                    value={decideReason}
                    onChange={(e) => setDecideReason(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                A decline reason is mandatory.
              </p>
              <div className="field">
                <label>Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={decideReason}
                  onChange={(e) => setDecideReason(e.target.value)}
                  placeholder="Enter decline reason…"
                />
              </div>
            </>
          )}
          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : `Confirm ${decideAction}`}
            </button>
            <button className="btn secondary" type="button" onClick={resetDecide}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card card--flush table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Requested</th>
              <th>Method</th>
              <th>Process</th>
              <th>Type</th>
              <th>Camp Date</th>
              <th>Slot</th>
              <th>Doctor</th>
              <th>HCW / Technician</th>
              <th>City</th>
              <th>Requester</th>
              <th>Status</th>
              {canApprove && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="mono-sm">{r.requestKey || '-'}</td>
                <td className="mono-sm">
                  {r.requestedAt
                    ? new Date(r.requestedAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '-'}
                </td>
                <td>{r.method || '-'}</td>
                <td>{r.process || '-'}</td>
                <td>{r.campType || '-'}</td>
                <td className="mono-sm">{r.campDate || '-'}</td>
                <td>
                  <span className="badge tone-neutral">{r.campSlot || '-'}</span>
                </td>
                <td>{r.doctorName || '-'}</td>
                <td>
                  {r.technicianName || '-'}
                  {r.technicianNumber ? (
                    <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                      {r.technicianNumber}
                    </span>
                  ) : null}
                </td>
                <td>{r.city || '-'}</td>
                <td>{r.requesterName || r.requesterEmail || '-'}</td>
                <td>
                  <span className={`badge ${statusTone(r.status)}`}>{r.status || '-'}</span>
                  {r.status === 'Pending' && isApprovalOverdue(r.requestedAt || r.createdAt) ? (
                    <span className="badge tone-danger" style={{ marginLeft: 6 }}>
                      Overdue
                    </span>
                  ) : null}
                  {r.decisionReason ? (
                    <span className="muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                      {r.decisionReason}
                    </span>
                  ) : null}
                </td>
                {canApprove && (
                  <td className="inv-actions">
                    {r.status === 'Pending' ? (
                      <>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => {
                            setDecideId(r._id);
                            setDecideAction('Approve');
                            setDecideReason('');
                            setDecideHcwContactId('');
                            setDecideHcwName('');
                            setDecideHcwNumber('');
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => {
                            setDecideId(r._id);
                            setDecideAction('Decline');
                            setDecideReason('');
                            setDecideHcwContactId('');
                            setDecideHcwName('');
                            setDecideHcwNumber('');
                          }}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={canApprove ? 13 : 12}>
                  <div className="inv-empty">
                    <strong>No camp requests yet</strong>
                    <p className="muted">
                      {canRequest
                        ? 'Submit a camp request to get started.'
                        : 'No requests available for your role.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {user?.email && (
        <p className="muted" style={{ marginTop: 12, fontSize: '0.82rem' }}>
          Signed in as {user.fullName || user.email}.{' '}
          {canApprove
            ? 'You can manage all camp requests.'
            : 'You can view your own requests and statuses.'}
        </p>
      )}
    </PageShell>
  );
}

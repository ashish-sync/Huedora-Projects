import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { FIELD, MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

const REQUEST_TYPES = [
  { value: 'REPAIR', label: 'Repair', needsAsset: true },
  { value: 'MAINTENANCE', label: 'Maintenance', needsAsset: true },
  { value: 'LOGISTICS', label: 'Logistics', needsAsset: true },
  { value: 'TRAINING', label: 'Training', needsAsset: false },
  { value: 'REIMBURSEMENT', label: 'Reimbursement', needsAsset: false },
  { value: 'OTHER', label: 'Other', needsAsset: false },
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const ISSUE_CATEGORIES = ['Hardware', 'Software', 'Calibration', 'Power', 'Cosmetic', 'Other'];
const MAINTENANCE_KINDS = ['Preventive', 'Corrective', 'Calibration', 'Inspection'];
const LOGISTICS_KINDS = ['Transfer', 'Pickup', 'Delivery', 'Return'];
const TRANSPORT_MODES = ['Road', 'Courier', 'Hand-carry', 'Other'];
const TRAINING_MODES = ['On-site', 'Virtual', 'Classroom'];
const EXPENSE_CATEGORIES = ['Travel', 'Meals', 'Parts', 'Shipping', 'Service', 'Misc'];
const OTHER_CATEGORIES = ['Access', 'Documentation', 'Escalation', 'General', 'Other'];

const EMPTY_FORM = {
  requestType: 'REPAIR',
  assetId: '',
  assetName: '',
  assetCustody: '',
  custodianState: '',
  custodianName: '',
  custodianContact: '',
  custodianCity: '',
  contactId: '',
  reason: '',
  priority: 'Medium',
  issueCategory: '',
  maintenanceKind: '',
  logisticsKind: '',
  preferredVendor: '',
  serviceProvider: '',
  expectedDate: '',
  scheduledDate: '',
  preferredDate: '',
  toContactId: '',
  toCity: '',
  transportMode: '',
  trainingTopic: '',
  trainingMode: '',
  traineeCount: '',
  venue: '',
  amount: '',
  currency: 'INR',
  expenseCategory: '',
  payeeName: '',
  expenseDate: '',
  otherCategory: '',
};

function contactRefId(asset) {
  const raw = asset?.contactId || asset?.hcwId;
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw._id || raw.id || '');
  return String(raw);
}

function snapshotFromAsset(asset, contactsById) {
  const cid = contactRefId(asset);
  const contact = cid ? contactsById.get(cid) : null;
  return {
    assetId: asset?._id ? String(asset._id) : '',
    assetName: asset?.deviceNameSnapshot || asset?.name || '',
    assetCustody: asset?.custody || '',
    custodianState: asset?.custodianState || asset?.location?.state || contact?.state || '',
    custodianName: asset?.custodianName || contact?.name || '',
    custodianContact: asset?.custodianContact || contact?.contact || contact?.mobile || '',
    custodianCity: asset?.custodianCity || asset?.location?.city || contact?.city || '',
    contactId: cid || '',
  };
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function typeMeta(value) {
  return REQUEST_TYPES.find((t) => t.value === value) || REQUEST_TYPES[0];
}

function displayType(t) {
  if (t === 'MOVEMENT') return 'Logistics';
  return REQUEST_TYPES.find((x) => x.value === t)?.label || t;
}

function detailSummary(r) {
  const bits = [
    r.priority,
    r.issueCategory || r.maintenanceKind || r.logisticsKind || r.expenseCategory || r.otherCategory,
    r.trainingTopic,
    r.amount != null && r.amount !== '' ? `${r.currency || 'INR'} ${r.amount}` : '',
  ].filter(Boolean);
  return bits.join(' · ');
}

export default function AssetRequestsPage() {
  const { can, user } = useAuth();
  const [searchParams] = useSearchParams();
  const canRequest =
    can('asset-requests:request') ||
    can('movements:request') ||
    can('repairs:write') ||
    can('maintenance:write') ||
    can('*');
  const canApprove =
    can('asset-requests:approve') || can('movements:approve') || can('*');

  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    const raw = String(searchParams.get('type') || '').toUpperCase();
    if (!raw) return;
    const allowed = REQUEST_TYPES.some((t) => t.value === raw);
    if (!allowed) return;
    setForm((prev) => ({ ...prev, requestType: raw }));
    setTypeFilter(raw);
  }, [searchParams]);

  const contactsById = useMemo(() => {
    const map = new Map();
    for (const c of contacts) map.set(String(c._id), c);
    return map;
  }, [contacts]);

  const custodyOptions = useMemo(
    () => uniqueSorted(assets.map((a) => a.custody)),
    [assets]
  );
  const assetNameOptions = useMemo(
    () =>
      assets.map((a) => ({
        id: String(a._id),
        label: a.deviceNameSnapshot || a.assetTag || a.serialNumber || String(a._id),
        serial: a.serialNumber || '',
      })),
    [assets]
  );
  const stateOptions = useMemo(
    () =>
      uniqueSorted([
        ...assets.map((a) => a.custodianState || a.location?.state),
        ...contacts.map((c) => c.state),
      ]),
    [assets, contacts]
  );
  const custodianNameOptions = useMemo(
    () =>
      uniqueSorted([
        ...assets.map((a) => a.custodianName || a.contactId?.name),
        ...contacts.map((c) => c.name),
      ]),
    [assets, contacts]
  );
  const contactOptions = useMemo(
    () =>
      uniqueSorted([
        ...assets.map((a) => a.custodianContact || a.contactId?.contact),
        ...contacts.map((c) => c.contact || c.mobile),
      ]),
    [assets, contacts]
  );
  const cityOptions = useMemo(
    () =>
      uniqueSorted([
        ...assets.map((a) => a.custodianCity || a.location?.city || a.contactId?.city),
        ...contacts.map((c) => c.city),
      ]),
    [assets, contacts]
  );

  const needsAsset = typeMeta(form.requestType).needsAsset;
  const filteredRows = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((r) => {
      const t = r.requestType === 'MOVEMENT' ? 'LOGISTICS' : r.requestType;
      return t === typeFilter;
    });
  }, [rows, typeFilter]);

  const load = () =>
    api('/asset-requests')
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api('/assets?limit=500')
      .then((r) => setAssets(r.data || []))
      .catch(() => {});
    api('/contacts?limit=500')
      .then((r) => setContacts(r.data || []))
      .catch(() => {});
  }, []);

  const applyLinked = (partial) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const linkFromAssetId = (assetId) => {
    const asset = assets.find((a) => String(a._id) === String(assetId));
    if (!asset) {
      applyLinked({ assetId });
      return;
    }
    applyLinked(snapshotFromAsset(asset, contactsById));
  };

  const linkFromCustody = (custody) => {
    const matches = assets.filter((a) => String(a.custody || '') === String(custody));
    if (matches.length === 1) {
      applyLinked(snapshotFromAsset(matches[0], contactsById));
      return;
    }
    applyLinked({
      assetCustody: custody,
      assetId: matches.some((a) => String(a._id) === form.assetId) ? form.assetId : '',
      assetName: '',
    });
  };

  const linkFromState = (state) => {
    const matches = assets.filter(
      (a) => String(a.custodianState || a.location?.state || '') === String(state)
    );
    if (matches.length === 1) {
      applyLinked(snapshotFromAsset(matches[0], contactsById));
      return;
    }
    const contactMatch = contacts.filter((c) => String(c.state || '') === String(state));
    if (contactMatch.length === 1) {
      const c = contactMatch[0];
      const assetForContact = assets.find((a) => contactRefId(a) === String(c._id));
      if (assetForContact) {
        applyLinked(snapshotFromAsset(assetForContact, contactsById));
        return;
      }
      applyLinked({
        custodianState: state,
        custodianName: c.name || '',
        custodianContact: c.contact || c.mobile || '',
        custodianCity: c.city || '',
        contactId: String(c._id),
      });
      return;
    }
    applyLinked({ custodianState: state });
  };

  const linkFromCustodianName = (name) => {
    const assetMatch = assets.filter(
      (a) => String(a.custodianName || a.contactId?.name || '') === String(name)
    );
    if (assetMatch.length === 1) {
      applyLinked(snapshotFromAsset(assetMatch[0], contactsById));
      return;
    }
    const contact = contacts.find((c) => String(c.name || '') === String(name));
    if (contact) {
      const assetForContact = assets.find((a) => contactRefId(a) === String(contact._id));
      if (assetForContact) {
        applyLinked(snapshotFromAsset(assetForContact, contactsById));
        return;
      }
      applyLinked({
        custodianName: contact.name || '',
        custodianContact: contact.contact || contact.mobile || '',
        custodianCity: contact.city || '',
        custodianState: contact.state || '',
        contactId: String(contact._id),
      });
      return;
    }
    applyLinked({ custodianName: name });
  };

  const linkFromCustodianContact = (phone) => {
    const assetMatch = assets.filter(
      (a) =>
        String(a.custodianContact || a.contactId?.contact || a.contactId?.mobile || '') ===
        String(phone)
    );
    if (assetMatch.length === 1) {
      applyLinked(snapshotFromAsset(assetMatch[0], contactsById));
      return;
    }
    const contact = contacts.find(
      (c) => String(c.contact || '') === String(phone) || String(c.mobile || '') === String(phone)
    );
    if (contact) {
      const assetForContact = assets.find((a) => contactRefId(a) === String(contact._id));
      if (assetForContact) {
        applyLinked(snapshotFromAsset(assetForContact, contactsById));
        return;
      }
      applyLinked({
        custodianName: contact.name || '',
        custodianContact: contact.contact || contact.mobile || '',
        custodianCity: contact.city || '',
        custodianState: contact.state || '',
        contactId: String(contact._id),
      });
      return;
    }
    applyLinked({ custodianContact: phone });
  };

  const linkFromCity = (city) => {
    const assetMatch = assets.filter(
      (a) =>
        String(a.custodianCity || a.location?.city || a.contactId?.city || '') === String(city)
    );
    if (assetMatch.length === 1) {
      applyLinked(snapshotFromAsset(assetMatch[0], contactsById));
      return;
    }
    const contact = contacts.find((c) => String(c.city || '') === String(city));
    if (contact) {
      const assetForContact = assets.find((a) => contactRefId(a) === String(contact._id));
      if (assetForContact) {
        applyLinked(snapshotFromAsset(assetForContact, contactsById));
        return;
      }
      applyLinked({
        custodianCity: city,
        custodianName: contact.name || '',
        custodianContact: contact.contact || contact.mobile || '',
        custodianState: contact.state || '',
        contactId: String(contact._id),
      });
      return;
    }
    applyLinked({ custodianCity: city });
  };

  const setType = (requestType) => {
    setForm((prev) => ({ ...prev, requestType }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (needsAsset && !form.assetId) {
      setError('Select a linked asset for this request type.');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = {
        requestType: form.requestType,
        assetId: form.assetId || undefined,
        assetName: form.assetName,
        assetCustody: form.assetCustody,
        custodianState: form.custodianState,
        custodianName: form.custodianName,
        custodianContact: form.custodianContact,
        custodianCity: form.custodianCity,
        contactId: form.contactId || undefined,
        reason: form.reason,
        priority: form.priority || undefined,
      };

      if (form.requestType === 'REPAIR') {
        body.issueCategory = form.issueCategory;
        body.preferredVendor = form.preferredVendor || undefined;
        body.expectedDate = form.expectedDate || undefined;
      }
      if (form.requestType === 'MAINTENANCE') {
        body.maintenanceKind = form.maintenanceKind;
        body.serviceProvider = form.serviceProvider || undefined;
        body.scheduledDate = form.scheduledDate || undefined;
      }
      if (form.requestType === 'LOGISTICS') {
        body.logisticsKind = form.logisticsKind;
        body.toContactId = form.toContactId || undefined;
        body.toCity = form.toCity || undefined;
        body.transportMode = form.transportMode || undefined;
        body.preferredDate = form.preferredDate || undefined;
      }
      if (form.requestType === 'TRAINING') {
        body.trainingTopic = form.trainingTopic;
        body.trainingMode = form.trainingMode || undefined;
        body.traineeCount = form.traineeCount || undefined;
        body.venue = form.venue || undefined;
        body.preferredDate = form.preferredDate || undefined;
      }
      if (form.requestType === 'REIMBURSEMENT') {
        body.amount = form.amount;
        body.currency = form.currency || 'INR';
        body.expenseCategory = form.expenseCategory;
        body.payeeName = form.payeeName || undefined;
        body.expenseDate = form.expenseDate || undefined;
      }
      if (form.requestType === 'OTHER') {
        body.otherCategory = form.otherCategory;
      }

      await api('/asset-requests', { method: 'POST', body });
      setForm({ ...EMPTY_FORM, requestType: form.requestType });
      setMsg('Request submitted. Designated approvers have been notified.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action) => {
    setError('');
    try {
      await api(`/asset-requests/${id}/${action}`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/asset-requests/export', 'Request_Center.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === 'REQUESTED').length;

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: MODULE.ASSET_REQUESTS }]}
      title={MODULE.ASSET_REQUESTS}
      description="Submit repair, maintenance, logistics, training, reimbursement, and other requests. Fields adapt to the type you choose."
      actions={
        <button className="btn secondary" type="button" disabled={exportBusy} onClick={downloadMaster}>
          {exportBusy ? 'Downloading…' : 'Download Excel'}
        </button>
      }
      kpis={[
        { label: 'Total requests', value: rows.length },
        { label: 'Pending approval', value: pending },
      ]}
    >
      {error && <p className="error">{error}</p>}
      {msg && <p className="rp-toast">{msg}</p>}

      {canRequest && (
        <form className="card arq-form" onSubmit={submit}>
          <h3>New request</h3>
          <div className="arq-grid">
            <div className="field">
              <label>Request Type *</label>
              <select required value={form.requestType} onChange={(e) => setType(e.target.value)}>
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* —— Repair —— */}
            {form.requestType === 'REPAIR' && (
              <>
                <div className="field">
                  <label>Issue category *</label>
                  <select
                    required
                    value={form.issueCategory}
                    onChange={(e) => setForm({ ...form, issueCategory: e.target.value })}
                  >
                    <option value="">Select</option>
                    {ISSUE_CATEGORIES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Preferred vendor</label>
                  <input
                    value={form.preferredVendor}
                    onChange={(e) => setForm({ ...form, preferredVendor: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="field">
                  <label>Expected return date</label>
                  <input
                    type="date"
                    value={form.expectedDate}
                    onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* —— Maintenance —— */}
            {form.requestType === 'MAINTENANCE' && (
              <>
                <div className="field">
                  <label>Maintenance kind *</label>
                  <select
                    required
                    value={form.maintenanceKind}
                    onChange={(e) => setForm({ ...form, maintenanceKind: e.target.value })}
                  >
                    <option value="">Select</option>
                    {MAINTENANCE_KINDS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Service provider</label>
                  <input
                    value={form.serviceProvider}
                    onChange={(e) => setForm({ ...form, serviceProvider: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="field">
                  <label>Scheduled date</label>
                  <input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* —— Logistics —— */}
            {form.requestType === 'LOGISTICS' && (
              <>
                <div className="field">
                  <label>Logistics kind *</label>
                  <select
                    required
                    value={form.logisticsKind}
                    onChange={(e) => setForm({ ...form, logisticsKind: e.target.value })}
                  >
                    <option value="">Select</option>
                    {LOGISTICS_KINDS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Transport mode</label>
                  <select
                    value={form.transportMode}
                    onChange={(e) => setForm({ ...form, transportMode: e.target.value })}
                  >
                    <option value="">Select</option>
                    {TRANSPORT_MODES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Preferred date</label>
                  <input
                    type="date"
                    value={form.preferredDate}
                    onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Move to {FIELD.CUSTODIAN}</label>
                  <select
                    value={form.toContactId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const c = contactsById.get(id);
                      setForm((prev) => ({
                        ...prev,
                        toContactId: id,
                        toCity: c?.city || prev.toCity,
                      }));
                    }}
                  >
                    <option value="">—</option>
                    {contacts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {c.city ? ` — ${c.city}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Move to city</label>
                  <input
                    value={form.toCity}
                    onChange={(e) => setForm({ ...form, toCity: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* —— Training —— */}
            {form.requestType === 'TRAINING' && (
              <>
                <div className="field">
                  <label>Training topic *</label>
                  <input
                    required
                    value={form.trainingTopic}
                    onChange={(e) => setForm({ ...form, trainingTopic: e.target.value })}
                    placeholder="e.g. Device handling, safety"
                  />
                </div>
                <div className="field">
                  <label>Mode</label>
                  <select
                    value={form.trainingMode}
                    onChange={(e) => setForm({ ...form, trainingMode: e.target.value })}
                  >
                    <option value="">Select</option>
                    {TRAINING_MODES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Trainee count</label>
                  <input
                    type="number"
                    min="1"
                    value={form.traineeCount}
                    onChange={(e) => setForm({ ...form, traineeCount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Venue / location</label>
                  <input
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Preferred date</label>
                  <input
                    type="date"
                    value={form.preferredDate}
                    onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* —— Reimbursement —— */}
            {form.requestType === 'REIMBURSEMENT' && (
              <>
                <div className="field">
                  <label>Amount *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="field">
                  <label>Expense category *</label>
                  <select
                    required
                    value={form.expenseCategory}
                    onChange={(e) => setForm({ ...form, expenseCategory: e.target.value })}
                  >
                    <option value="">Select</option>
                    {EXPENSE_CATEGORIES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Payee name</label>
                  <input
                    value={form.payeeName}
                    onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Expense date</label>
                  <input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* —— Other —— */}
            {form.requestType === 'OTHER' && (
              <div className="field">
                <label>Category *</label>
                <select
                  required
                  value={form.otherCategory}
                  onChange={(e) => setForm({ ...form, otherCategory: e.target.value })}
                >
                  <option value="">Select</option>
                  {OTHER_CATEGORIES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* —— Asset / custodian (required for asset types; optional otherwise) —— */}
            <div className="field arq-span">
              <h4 className="arq-section-title">
                {needsAsset ? 'Linked asset *' : 'Linked asset (optional)'}
              </h4>
            </div>

            <div className="field">
              <label>{FIELD.ASSET_CUSTODY}</label>
              <select value={form.assetCustody} onChange={(e) => linkFromCustody(e.target.value)}>
                <option value="">Select</option>
                {custodyOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>
                {FIELD.ASSET_NAME}
                {needsAsset ? ' *' : ''}
              </label>
              <select
                required={needsAsset}
                value={form.assetId}
                onChange={(e) => linkFromAssetId(e.target.value)}
              >
                <option value="">Select asset</option>
                {assetNameOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.serial ? ` · ${a.serial}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{FIELD.CUSTODIAN_STATE}</label>
              <select value={form.custodianState} onChange={(e) => linkFromState(e.target.value)}>
                <option value="">Select</option>
                {stateOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{FIELD.CUSTODIAN_NAME}</label>
              <select value={form.custodianName} onChange={(e) => linkFromCustodianName(e.target.value)}>
                <option value="">Select</option>
                {custodianNameOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{FIELD.CUSTODIAN_CONTACT}</label>
              <select
                value={form.custodianContact}
                onChange={(e) => linkFromCustodianContact(e.target.value)}
              >
                <option value="">Select</option>
                {contactOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{FIELD.CUSTODIAN_CITY}</label>
              <select value={form.custodianCity} onChange={(e) => linkFromCity(e.target.value)}>
                <option value="">Select</option>
                {cityOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="field arq-span">
              <label>Reason / description *</label>
              <textarea
                required
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Why is this request needed?"
              />
            </div>
          </div>
          <p className="muted arq-hint">
            Linked Asset Registry and Contact Directory fields auto-fill when a unique match is found.
            Asset is required for Repair, Maintenance, and Logistics.
          </p>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      )}

      <div className="arq-type-tabs" role="tablist" aria-label="Filter by request type">
        <button
          type="button"
          className={`arq-type-tab${!typeFilter ? ' is-active' : ''}`}
          onClick={() => setTypeFilter('')}
        >
          All
        </button>
        {REQUEST_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`arq-type-tab${typeFilter === t.value ? ' is-active' : ''}`}
            onClick={() => setTypeFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Details</th>
              <th>Asset</th>
              <th>Requestor</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const isMine = String(r.requestorId?._id || r.requestorId) === String(user?.id);
              return (
                <tr key={r._id}>
                  <td className="mono-sm">{r.requestNumber}</td>
                  <td>{displayType(r.requestType)}</td>
                  <td>
                    <span className="badge tone-neutral">{r.status}</span>
                  </td>
                  <td className="muted mono-sm">{detailSummary(r) || '—'}</td>
                  <td>
                    <strong>{r.assetName || r.trainingTopic || '—'}</strong>
                    <div className="muted mono-sm">{r.assetCustody || r.payeeName || ''}</div>
                  </td>
                  <td>{r.requestorId?.fullName || r.requestorId?.email || '—'}</td>
                  <td className="arq-reason">{r.reason || '—'}</td>
                  <td>
                    <div className="arq-actions">
                      {canApprove && r.status === 'REQUESTED' && !isMine && (
                        <>
                          <button type="button" className="btn btn-compact" onClick={() => act(r._id, 'approve')}>
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn secondary btn-compact"
                            onClick={() => act(r._id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {canApprove && r.status === 'APPROVED' && (
                        <button type="button" className="btn secondary btn-compact" onClick={() => act(r._id, 'complete')}>
                          Complete
                        </button>
                      )}
                      {r.status === 'REQUESTED' && isMine && (
                        <span className="muted mono-sm">Awaiting approval</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredRows.length && (
              <tr>
                <td colSpan={8} className="muted">
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

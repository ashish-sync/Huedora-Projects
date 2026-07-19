import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { campApi, clientApi, clientMasterApi } from './campOpsApi.js';
import { trimFormStrings } from './utils/trimInput';
import { toApiDateValue } from './utils/dateFormat';
import { computeEndTime } from './utils/campSchedule';
import { CampNameSelect } from './components/CampNameSelect';
import { DateInput } from './components/DateInput';
import { FormPageHeader } from './components/FormPageHeader';
import { StateSearchInput } from './components/StateSearchInput';
import { buildSourcePreview } from './utils/formatSourceMessage';
import { CAMP_NAME_OPTIONS } from './constants/campNames';

const EDITABLE_STATUSES = ['pending_review', 'approved', 'rejected'];

const NO_DIVISION_MESSAGE = 'Create business unit / division first in Client Master before creating a camp.';

function filterApprovalBlockers(blockers, form) {
  const campDivision = String(form.campaignType || '').trim();
  const campCampName = String(form.campaignName || '').trim();
  const hasValidDivision = Boolean(campDivision);
  const hasValidCampName = CAMP_NAME_OPTIONS.includes(campCampName);

  return (blockers || []).filter((message) => {
    if (message.includes('division / business unit')) {
      return !hasValidDivision;
    }
    if (message.includes('valid camp name')) {
      return !hasValidCampName;
    }
    if (message.includes('No matching program in Client Master')) {
      return !(hasValidDivision && hasValidCampName);
    }
    return true;
  });
}

const formStringFields = [
  'campaignName', 'doctorName', 'doctorCode', 'hospitalName',
  'campAddress', 'city', 'state', 'pincode', 'startTime', 'endTime',
  'fieldPersonName', 'fieldPersonPhone', 'remarks',
];

const DURATION_OPTIONS = [3, 4, 5, 6, 8];

const emptyForm = {
  clientId: '',
  campaignName: 'BMD',
  campaignType: '',
  doctorName: '',
  doctorCode: '',
  hospitalName: '',
  campAddress: '',
  city: '',
  state: '',
  pincode: '',
  campDate: '',
  startTime: '09:00',
  endTime: '12:00',
  durationHours: 3,
  expectedPatients: 50,
  fieldPersonName: '',
  fieldPersonPhone: '',
  remarks: '',
  source: 'dashboard',
};

export default function CampFormPage() {
  const { id } = useParams();
  const { canEditCampRecord } = useAuth();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [campMeta, setCampMeta] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [showSourcePreview, setShowSourcePreview] = useState(false);

  useEffect(() => {
    clientApi.list({ limit: 500, page: 1 }).then(({ data }) => setClients(Array.isArray(data?.data) ? data.data : []));
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setDivisionOptions([]);
      return undefined;
    }

    let cancelled = false;
    setProgramsLoading(true);
    clientMasterApi.listDivisionsByClient(form.clientId)
      .then(({ data }) => {
        if (cancelled) return;
        const divisions = Array.isArray(data?.divisions)
          ? data.divisions
          : Array.isArray(data?.data)
            ? data.data.map((d) => d.programName || d).filter(Boolean)
            : [];
        setDivisionOptions(divisions);

        if (!isEdit) {
          setForm((prev) => {
            const next = { ...prev, campaignType: divisions.length === 1 ? divisions[0] : '' };
            if (prev.campaignType && !divisions.includes(prev.campaignType)) {
              next.campaignType = divisions.length === 1 ? divisions[0] : '';
            }
            return next;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setDivisionOptions([]);
      })
      .finally(() => {
        if (!cancelled) setProgramsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.clientId, isEdit]);

  useEffect(() => {
    if (!isEdit) return undefined;

    setFetching(true);
    campApi.get(id)
      .then(({ data }) => {
        const camp = data.data;
        setCampMeta({
          campId: camp.campId,
          status: camp.status,
          source: camp.source,
          approvalBlockers: camp.approvalBlockers || [],
          canApprove: camp.canApprove !== false,
          emailSubject: camp.emailSubject,
          emailSender: camp.emailSender,
          emailRawBody: camp.emailRawBody,
          whatsappSenderPhone: camp.whatsappSenderPhone,
          whatsappRawMessage: camp.whatsappRawMessage,
          submittedAt: camp.submittedAt || camp.createdAt,
        });
        if (!canEditCampRecord(camp)) {
          setError('You can only edit camps that are pending review.');
          setReadOnly(true);
        } else {
          setReadOnly(!EDITABLE_STATUSES.includes(camp.status));
        }
        setForm({
          clientId: camp.client?._id || camp.client || '',
          campaignName: camp.campaignName || 'BMD',
          campaignType: camp.campaignType || '',
          doctorName: camp.doctorName || '',
          doctorCode: camp.doctorCode || '',
          hospitalName: camp.hospitalName || camp.clinicName || '',
          campAddress: camp.campAddress || '',
          city: camp.city || '',
          state: camp.state || '',
          pincode: camp.pincode || '',
          campDate: toApiDateValue(camp.campDate),
          startTime: camp.startTime || '09:00',
          endTime: camp.endTime || '12:00',
          durationHours: camp.durationHours || 3,
          expectedPatients: camp.expectedPatients ?? 50,
          fieldPersonName: camp.fieldPersonName || '',
          fieldPersonPhone: camp.fieldPersonPhone || '',
          remarks: camp.remarks || '',
          source: camp.source || 'dashboard',
        });
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load camp');
      })
      .finally(() => setFetching(false));

    return undefined;
  }, [id, isEdit]);

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'clientId') {
        next.campaignType = '';
      }
      if (field === 'startTime' || field === 'durationHours') {
        const hours = Number(field === 'durationHours' ? value : next.durationHours) || 3;
        const start = field === 'startTime' ? value : next.startTime;
        next.durationHours = hours;
        next.endTime = computeEndTime(start, hours);
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (readOnly) return;

    if (!form.clientId) {
      setError('Please select a client');
      return;
    }

    if (!divisionOptions.length) {
      setError(NO_DIVISION_MESSAGE);
      return;
    }

    if (!form.campaignType || !divisionOptions.includes(form.campaignType)) {
      setError('Please select a division / business unit configured for this client');
      return;
    }

    if (!CAMP_NAME_OPTIONS.includes(form.campaignName)) {
      setError('Please select a camp name');
      return;
    }

    const trimmed = trimFormStrings(form, formStringFields);
    const payload = {
      ...trimmed,
      clientId: form.clientId,
      campDate: toApiDateValue(form.campDate),
      durationHours: form.durationHours,
      expectedPatients: form.expectedPatients,
    };

    setForm({ ...form, ...trimmed });
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await campApi.update(id, payload);
      } else {
        await campApi.create({ ...payload, source: form.source });
      }
      navigate('/camps/manage');
    } catch (err) {
      setError(err?.message || 'Failed to save camp');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <div className="empty-state">Loading camp...</div>;
  }

  const visibleApprovalBlockers = campMeta?.status === 'pending_review' && campMeta.canApprove === false
    ? filterApprovalBlockers(campMeta.approvalBlockers, form)
    : [];

  const hasNoDivisions = Boolean(form.clientId) && !programsLoading && divisionOptions.length === 0;
  const canSubmit = !readOnly && !hasNoDivisions;

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <FormPageHeader
        title={isEdit ? 'Edit Camp' : 'Create Camp'}
        backTo="/camps/manage"
      />
      {campMeta && (
        <div className="meta-text camp-form-meta" style={{ marginBottom: '1rem' }}>
          <div><strong>Camp ID:</strong> {campMeta.campId}</div>
          <div><strong>Status:</strong> {campMeta.status.replaceAll('_', ' ')}</div>
          {campMeta.source && <div><strong>Source:</strong> {campMeta.source}</div>}
        </div>
      )}

      <div className="camp-form-alerts">
        {campMeta && campMeta.status === 'pending_review' && visibleApprovalBlockers.length > 0 && (
          <div className="error-banner">
            Cannot approve until resolved: {visibleApprovalBlockers.join(' ')}
          </div>
        )}
        {readOnly && (
          <div className="error-banner">
            This camp has been executed or cancelled and can no longer be edited.
          </div>
        )}
        {hasNoDivisions && (
          <div className="error-banner">{NO_DIVISION_MESSAGE}</div>
        )}
        {error && <div className="error-banner">{error}</div>}
      </div>

      {isEdit && campMeta && (campMeta.source === 'email' || campMeta.source === 'whatsapp') && (
        <div className="camp-form-source-section">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSourcePreview((open) => !open)}
          >
            {showSourcePreview ? 'Hide' : 'View'} original {campMeta.source === 'email' ? 'email' : 'WhatsApp'}
          </button>

          {showSourcePreview && (
            <div
              className="form-card"
              style={{ marginTop: '0.75rem', background: 'var(--surface-muted, #f6f7f9)' }}
            >
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '360px',
                  overflow: 'auto',
                  margin: 0,
                  padding: '0.75rem',
                  background: '#fff',
                  border: '1px solid #e2e5ea',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  lineHeight: 1.55,
                }}
              >
                {buildSourcePreview(campMeta) || 'No original message stored for this camp.'}
              </pre>
            </div>
          )}
        </div>
      )}

      <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
        <div className="form-grid">
          <label htmlFor="camp-client">
            Client Name
            <select id="camp-client" value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} required>
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label htmlFor="camp-division">
            Division / Business Unit
            <select
              id="camp-division"
              value={form.campaignType}
              onChange={(e) => updateField('campaignType', e.target.value)}
              disabled={readOnly || programsLoading || !form.clientId || !divisionOptions.length}
              required
            >
              <option value="">
                {programsLoading
                  ? 'Loading divisions...'
                  : !form.clientId
                    ? 'Select client first'
                    : divisionOptions.length
                      ? 'Select division / business unit'
                      : 'No division configured'}
              </option>
              {divisionOptions.map((division) => (
                <option key={division} value={division}>{division}</option>
              ))}
            </select>
          </label>
          <label htmlFor="camp-name">
            Camp Name
            <CampNameSelect
              id="camp-name"
              value={form.campaignName}
              onChange={(value) => updateField('campaignName', value)}
              disabled={readOnly}
              required
            />
          </label>
          <label htmlFor="camp-doctor-name">
            Doctor Name
            <input id="camp-doctor-name" value={form.doctorName} onChange={(e) => updateField('doctorName', e.target.value)} />
          </label>
          <label htmlFor="camp-doctor-code">
            Doctor Code
            <input id="camp-doctor-code" value={form.doctorCode} onChange={(e) => updateField('doctorCode', e.target.value)} />
          </label>
          <label htmlFor="camp-clinic-hospital">
            Clinic / Hospital
            <input id="camp-clinic-hospital" value={form.hospitalName} onChange={(e) => updateField('hospitalName', e.target.value)} />
          </label>
          <label className="full" htmlFor="camp-address">
            Camp Address
            <input id="camp-address" value={form.campAddress} onChange={(e) => updateField('campAddress', e.target.value)} />
          </label>
          <label htmlFor="camp-city">
            City
            <input id="camp-city" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
          </label>
          <label htmlFor="camp-state">
            State
            <StateSearchInput
              id="camp-state"
              value={form.state}
              onChange={(value) => updateField('state', value)}
              disabled={readOnly}
            />
          </label>
          <label htmlFor="camp-pincode">
            Pincode
            <input id="camp-pincode" value={form.pincode} onChange={(e) => updateField('pincode', e.target.value)} />
          </label>
          <label htmlFor="camp-date">
            Camp Date
            <DateInput
              id="camp-date"
              hideLabel
              value={form.campDate}
              onChange={(value) => updateField('campDate', value)}
              required
            />
          </label>
          <label htmlFor="camp-duration">
            Camp Duration
            <select id="camp-duration" value={form.durationHours} onChange={(e) => updateField('durationHours', Number(e.target.value))}>
              {DURATION_OPTIONS.map((hours) => (
                <option key={hours} value={hours}>{hours} hour camp</option>
              ))}
            </select>
          </label>
          <label htmlFor="camp-start-time">
            Start Time
            <input id="camp-start-time" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} />
          </label>
          <label htmlFor="camp-end-time">
            End Time
            <input id="camp-end-time" value={form.endTime} readOnly />
          </label>
          <label htmlFor="camp-expected-patients">
            Expected Patients
            <input
              id="camp-expected-patients"
              type="number"
              value={form.expectedPatients}
              onChange={(e) => updateField('expectedPatients', Number(e.target.value))}
            />
          </label>
          <label htmlFor="camp-field-person">
            Field Person Name
            <input id="camp-field-person" value={form.fieldPersonName} onChange={(e) => updateField('fieldPersonName', e.target.value)} />
          </label>
          <label htmlFor="camp-field-phone">
            Field Person Contact
            <input
              id="camp-field-phone"
              type="tel"
              inputMode="tel"
              value={form.fieldPersonPhone}
              onChange={(e) => updateField('fieldPersonPhone', e.target.value.replace(/[^\d+\-\s]/g, ''))}
            />
          </label>
          <label className="full" htmlFor="camp-remarks">
            Remarks
            <textarea id="camp-remarks" rows={3} value={form.remarks} onChange={(e) => updateField('remarks', e.target.value)} />
          </label>
        </div>
      </fieldset>
      <div className="form-actions">
        {!readOnly && (
          <button className="btn btn-primary" disabled={loading || !canSubmit}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Camp'}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/camps/manage')}>
          {readOnly ? 'Back to Camps' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}

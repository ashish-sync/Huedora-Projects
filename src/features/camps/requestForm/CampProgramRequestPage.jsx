import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AutofillDecoyFields } from '../../../shared/suppressBrowserAutofill.js';
import { GeoLookupContext } from '../../../shared/GeoLookupContext.jsx';
import { CampLifecycleForm } from '../components/CampLifecycleForm.jsx';
import { emptyLifecycleForm, todayIsoDate } from '../constants/campLifecycle.js';
import { validateRequestStageForm } from '../utils/validateRequestStage.js';
import { confirmCampDurationIfNeeded } from '../utils/campDurationWarning.js';
import { trimFormStrings } from '../utils/trimInput.js';
import { toApiDateValue } from '../utils/dateFormat.js';
import { parseCampDurationToHours } from '../utils/campClientMasterPricing.js';
import { computeEndTime } from '../utils/campSchedule.js';
import { syncPrimaryContactFields, normalizeContactPersons } from '../utils/campContactPersons.js';
import { campRequestFormApi } from './campRequestFormApi.js';
import '../campOps.css';
import '../campOps.theme.css';
import '../executor/campExecute.css';
import './campProgramRequest.css';

const TYLO_LOGO_SRC = '/brand/tylo-logo.jpg';

const FORM_STRING_FIELDS = [
  'campaignName', 'campaignType', 'doctorName', 'doctorCode', 'campAddress', 'city', 'state', 'district',
  'pincode', 'latitude', 'longitude', 'googlePlaceId', 'startTime', 'endTime', 'contactPersonLevel',
  'fieldPersonName', 'fieldPersonPhone', 'remarks', 'hq', 'zone', 'source', 'requestDate',
];

function seedFormFromProgram(ctx) {
  const form = emptyLifecycleForm();
  const hours = parseCampDurationToHours(ctx?.campDuration) || 4;
  const startTime = '09:00';
  return {
    ...form,
    source: 'program_form',
    clientId: ctx?.clientId || '',
    clientName: ctx?.clientName || '',
    campaignType: ctx?.programName || '',
    campaignName: ctx?.campName || '',
    durationHours: hours,
    startTime,
    endTime: computeEndTime(startTime, hours) || '13:00',
    requestDate: todayIsoDate(),
  };
}

export default function CampProgramRequestPage() {
  const { token } = useParams();
  const [context, setContext] = useState(null);
  const [form, setForm] = useState(() => emptyLifecycleForm());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    campRequestFormApi.load(token)
      .then((data) => {
        if (cancelled) return;
        setContext(data);
        setForm(seedFormFromProgram(data));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'This camp request form is not available');
        setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateFields = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const geoLookup = useMemo(() => ({
    lookupPin: (pin) => campRequestFormApi.lookupPin(token, pin),
    fetchStates: () => campRequestFormApi.fetchStates(token),
    fetchDistricts: (stateId) => campRequestFormApi.fetchDistricts(token, stateId),
    fetchCities: (stateId) => campRequestFormApi.fetchCities(token, stateId),
  }), [token]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (busy || submitted) return;
    const requestErrors = validateRequestStageForm(form, { skipLocation: true });
    if (requestErrors.length) {
      setError(requestErrors[0]);
      return;
    }
    const duration = Number(form.durationHours);
    if (!confirmCampDurationIfNeeded(duration)) return;

    const trimmed = trimFormStrings(form, FORM_STRING_FIELDS);
    const contactFields = syncPrimaryContactFields(normalizeContactPersons(form));
    const payload = {
      ...form,
      ...trimmed,
      ...contactFields,
      clientId: context?.clientId || form.clientId,
      clientName: context?.clientName || form.clientName,
      campaignType: context?.programName || form.campaignType,
      campaignName: context?.campName || form.campaignName,
      source: 'program_form',
      campDate: toApiDateValue(form.campDate),
      requestDate: todayIsoDate(),
      expectedPatients: Number(String(form.expectedPatients ?? '').trim() || 0),
      lifecycleStage: 'request',
    };
    delete payload.hqManuallyEdited;
    delete payload.addressPlacesAvailable;
    delete payload.executionDocuments;
    delete payload.consumablesUsed;

    setBusy(true);
    setError('');
    try {
      const result = await campRequestFormApi.submit(token, payload);
      setSubmitted(result);
    } catch (err) {
      setError(err?.message || 'Could not submit the camp request');
    } finally {
      setBusy(false);
    }
  }

  const divisionOptions = context?.programName ? [context.programName] : [];
  const campNameOptions = context?.campName ? [context.campName] : [];

  const brand = (
    <header className="camp-program-request__brand">
      <img
        className="camp-program-request__logo"
        src={TYLO_LOGO_SRC}
        alt="TYLO"
        width={140}
        height={40}
        decoding="async"
      />
      <h1>New Camp Request</h1>
    </header>
  );

  return (
    <div className="camp-execute camp-program-request">
      <main className="camp-program-request__body">
        <section className="camp-program-request__sheet">
          {brand}
          {loading ? (
            <p className="camp-program-request__status">Loading form…</p>
          ) : submitted ? (
            <div className="camp-execute__success" role="status">
              Request submitted for Camp One review
              {submitted.campId ? ` as ${submitted.campId}` : ''}.
            </div>
          ) : !context ? (
            <div className="camp-execute__error" role="alert">
              {error || 'This camp request form is not available'}
            </div>
          ) : (
            <form className="camp-ops-root camp-program-request__form" onSubmit={handleSubmit} autoComplete="off">
              <AutofillDecoyFields />
              {error ? <div className="camp-execute__error" role="alert">{error}</div> : null}
              <p className="camp-program-request__program">
                {context.clientName}
                {context.programName ? ` · ${context.programName}` : ''}
                {context.campName ? ` · ${context.campName}` : ''}
              </p>
              <GeoLookupContext.Provider value={geoLookup}>
                <CampLifecycleForm
                  form={form}
                  updateField={updateField}
                  updateFields={updateFields}
                  activeStage="request"
                  onStageChange={() => {}}
                  campStatus="pending_review"
                  divisionOptions={divisionOptions}
                  campNameOptions={campNameOptions}
                  reachedLifecycleStage="request"
                  requestOnly
                  lockProgramFields
                  canSetHistoricalCampDates={false}
                  onValidationError={setError}
                />
              </GeoLookupContext.Provider>
              <div className="camp-program-request__actions">
                <button
                  type="submit"
                  className="camp-execute__btn primary camp-execute__btn--submit"
                  disabled={busy}
                >
                  {busy ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

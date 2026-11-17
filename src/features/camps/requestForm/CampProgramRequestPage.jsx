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
import { computeDurationHours, computeEndTime } from '../utils/campSchedule.js';
import { syncPrimaryContactFields, normalizeContactPersons } from '../utils/campContactPersons.js';
import { formatDoctorName, formatDoctorNameLive } from '../../../shared/textFormat.js';
import { campRequestFormApi } from './campRequestFormApi.js';
import {
  applyFieldFormat,
  getFormMasterCampDateErrors,
  normalizeFormSettings,
  validateFormMasterValues,
} from '../../masters/formFieldRuntime.js';
import {
  ADVANCE_BOOKING_LEAD_TIME_ERROR,
  getAdvanceBookingEligibility,
  getAdvanceBookingErrors,
  minCampDateIsoSatisfyingAdvanceBooking,
} from '../utils/campAdvanceBooking.js';
import '../campOps.css';
import '../campOps.theme.css';
import '../executor/campExecute.css';
import './campProgramRequest.css';

const TYLO_LOGO_SRC = '/brand/tylo-logo.jpg';

const FORM_STRING_FIELDS = [
  'campaignName', 'campaignType', 'doctorName', 'doctorCode', 'campAddress', 'city', 'state', 'district',
  'pincode', 'latitude', 'longitude', 'googlePlaceId', 'startTime', 'endTime', 'contactPersonLevel',
  'fieldPersonName', 'fieldPersonPhone', 'remarks', 'hq', 'zone', 'source', 'requestDate', 'speciality',
];

function seedFormFromProgram(ctx) {
  const form = emptyLifecycleForm();
  const hours = parseCampDurationToHours(ctx?.campDuration) || 4;
  // Public form starts blank — applicants must fill every field (no time/specialty defaults).
  return {
    ...form,
    source: 'program_form',
    clientId: ctx?.clientId || '',
    clientName: ctx?.clientName || '',
    campaignType: ctx?.programName || '',
    campaignName: ctx?.campName || '',
    durationHours: hours,
    startTime: '',
    endTime: '',
    campSlot: '',
    speciality: '',
    expectedPatients: '',
    contactPersonLevel: '',
    contactPersons: [{ level: '', name: '', phone: '' }],
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

  const formMasterFields = useMemo(
    () => (Array.isArray(context?.form?.fields) ? context.form.fields : []),
    [context?.form?.fields],
  );

  const formSettings = useMemo(
    () => normalizeFormSettings(
      context?.form?.settings || context?.formSettings,
      context?.form?.category || 'PUBLIC_CAMP_REQUEST',
    ),
    [context?.form?.settings, context?.form?.category, context?.formSettings],
  );

  const fieldConfigByKey = useMemo(() => {
    const map = new Map();
    for (const field of formMasterFields) {
      if (field?.key) map.set(String(field.key), field);
    }
    return map;
  }, [formMasterFields]);

  const updateField = useCallback((key, value) => {
    setForm((prev) => {
      const def = fieldConfigByKey.get(key);
      const shouldFormat = formSettings.enforceFieldRules && def?.format;
      let nextValue = shouldFormat ? applyFieldFormat(value, def.format) : value;
      if (key === 'doctorName') nextValue = formatDoctorNameLive(nextValue);
      const next = { ...prev, [key]: nextValue };

      // Keep End Time aligned with Start Time + camp duration so the public
      // form never leaves End Time blank after a start-time change.
      if (key === 'startTime' && nextValue) {
        const duration = Number(prev.durationHours) > 0
          ? Number(prev.durationHours)
          : (prev.startTime && prev.endTime
            ? computeDurationHours(prev.startTime, prev.endTime)
            : 4);
        const endTime = computeEndTime(nextValue, duration);
        if (endTime) {
          next.endTime = endTime;
          next.durationHours = duration;
        }
      } else if (key === 'endTime' && nextValue && prev.startTime) {
        next.durationHours = computeDurationHours(prev.startTime, nextValue);
      }

      return next;
    });
  }, [fieldConfigByKey, formSettings.enforceFieldRules]);

  const updateFields = useCallback((patch) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(patch || {})) {
        const def = fieldConfigByKey.get(key);
        let nextValue = formSettings.enforceFieldRules && def?.format
          ? applyFieldFormat(value, def.format)
          : value;
        if (key === 'doctorName') nextValue = formatDoctorNameLive(nextValue);
        next[key] = nextValue;
      }
      if (patch?.startTime && !patch?.endTime) {
        const duration = Number(next.durationHours) > 0 ? Number(next.durationHours) : 4;
        const endTime = computeEndTime(next.startTime, duration);
        if (endTime) next.endTime = endTime;
      }
      return next;
    });
  }, [fieldConfigByKey, formSettings.enforceFieldRules]);

  const geoLookup = useMemo(() => ({
    lookupPin: (pin) => campRequestFormApi.lookupPin(token, pin),
    fetchStates: () => campRequestFormApi.fetchStates(token),
    fetchDistricts: (stateId) => campRequestFormApi.fetchDistricts(token, stateId),
    fetchCities: (stateId) => campRequestFormApi.fetchCities(token, stateId),
  }), [token]);

  const addressLookup = useMemo(() => ({
    autocomplete: (input) => campRequestFormApi.autocompleteAddress(token, input),
  }), [token]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (busy || submitted) return;
    const requestErrors = validateRequestStageForm(form, {
      canSetHistorical: false,
      requireAllFields: true,
    });
    if (requestErrors.length) {
      setError(requestErrors[0]);
      return;
    }
    if (formSettings.enforceFieldRules && formMasterFields.length) {
      const masterErrors = validateFormMasterValues(formMasterFields, form);
      if (masterErrors.length) {
        setError(masterErrors[0]);
        return;
      }
    }
    const dateErrors = getFormMasterCampDateErrors(form);
    if (dateErrors.length) {
      setError(dateErrors[0]);
      return;
    }
    const bookingErrors = getAdvanceBookingErrors(
      {
        campDate: form.campDate,
        startTime: form.startTime,
        requestDate: form.requestDate,
      },
      new Date(),
      { checkAcceptanceWindow: false },
    );
    if (bookingErrors.length) {
      setError(bookingErrors[0] || ADVANCE_BOOKING_LEAD_TIME_ERROR);
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
      doctorName: formatDoctorName(trimmed.doctorName || form.doctorName),
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

  const minCampDate = useMemo(
    () => minCampDateIsoSatisfyingAdvanceBooking(new Date(), form.startTime || '10:00'),
    [form.startTime],
  );

  const advanceBookingEligibility = useMemo(
    () => getAdvanceBookingEligibility(
      {
        campDate: form.campDate,
        startTime: form.startTime,
        requestDate: form.requestDate,
      },
      new Date(),
    ),
    [form.campDate, form.startTime, form.requestDate],
  );

  const advanceBookingError = advanceBookingEligibility.ready && !advanceBookingEligibility.ok
    ? advanceBookingEligibility.message
    : '';
  const advanceBookingHint = advanceBookingEligibility.ready && advanceBookingEligibility.ok
    ? advanceBookingEligibility.message
    : (!form.campDate || !form.startTime ? advanceBookingEligibility.message : '');

  useEffect(() => {
    if (!form.campDate || !minCampDate) return;
    if (String(form.campDate).slice(0, 10) < minCampDate) {
      updateField('campDate', minCampDate);
    }
  }, [form.campDate, minCampDate, updateField]);

  // Heal blank End Time (e.g. cleared native picker) from Start + duration.
  useEffect(() => {
    if (!form.startTime || form.endTime) return;
    const duration = Number(form.durationHours) > 0 ? Number(form.durationHours) : 4;
    const endTime = computeEndTime(form.startTime, duration);
    if (endTime) updateField('endTime', endTime);
  }, [form.startTime, form.endTime, form.durationHours, updateField]);

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
                  stageReadOnly={{}}
                  requestOnly
                  lockProgramFields
                  addressLookup={addressLookup}
                  minCampDate={minCampDate}
                  advanceBookingError={advanceBookingError}
                  advanceBookingHint={advanceBookingHint}
                />
              </GeoLookupContext.Provider>
              <div className="camp-program-request__actions">
                <button
                  type="submit"
                  className="camp-execute__btn primary"
                  disabled={busy}
                >
                  {busy ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

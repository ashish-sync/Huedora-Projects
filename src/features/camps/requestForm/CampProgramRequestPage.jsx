import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { validateImportFileClient, getErrorMessage } from '../../../shared/importErrors.js';
import { IMPORT_ACCEPT_ATTR } from '../../../shared/importFilePolicy.js';
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

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function formatImportResult(result) {
  const created = Number(result?.summary?.created || 0);
  const skipped = Number(result?.summary?.skipped || 0);
  const failed = Number(result?.summary?.failed || 0);
  const campWord = created === 1 ? 'camp request' : 'camp requests';
  if (created && !skipped && !failed) {
    return `${created} ${campWord} submitted for Camp One review.`;
  }
  const parts = [];
  if (created) parts.push(`${created} submitted`);
  if (skipped) parts.push(`${skipped} skipped as duplicates`);
  if (failed) parts.push(`${failed} ${failed === 1 ? 'row' : 'rows'} failed`);
  const firstFail = result?.failed?.[0]?.reason;
  const suffix = firstFail ? ` ${firstFail.replace(/[.]+$/, '')}.` : '.';
  return `${parts.join(', ') || 'No rows were imported'}.${failed && firstFail ? suffix : ''}`;
}

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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

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

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
    if (busy || uploading || submitted) return;
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
    setImportResult(null);
    try {
      const result = await campRequestFormApi.submit(token, payload);
      setSubmitted(result);
    } catch (err) {
      setError(err?.message || 'Could not submit the camp request');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadSample() {
    setMenuOpen(false);
    setError('');
    try {
      const blob = await campRequestFormApi.downloadSample(token);
      if (blob?.type && blob.type.includes('application/json')) {
        const json = JSON.parse(await blob.text());
        throw new Error(json?.error?.message || json?.message || 'Could not download the sample template');
      }
      downloadBlob(blob, 'camp-request-form_Sample.csv');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not download the sample template'));
    }
  }

  function handleUploadData() {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }

  async function handleUploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const invalid = validateImportFileClient(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploading(true);
    setError('');
    setImportResult(null);
    try {
      const result = await campRequestFormApi.uploadData(token, file);
      setImportResult(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload the file'));
    } finally {
      setUploading(false);
    }
  }

  const divisionOptions = context?.programName ? [context.programName] : [];
  const campNameOptions = context?.campName ? [context.campName] : [];
  const importMessage = importResult ? formatImportResult(importResult) : '';
  const importFailed = Boolean(importResult && !importResult.summary?.created && importResult.summary?.failed);

  const brand = (
    <header className="camp-program-request__brand">
      <h1>New Camp Request</h1>
      <div className="camp-program-request__brand-end">
        {context ? (
          <div className="camp-program-request__bulk" ref={menuRef}>
            <button
              type="button"
              className="camp-program-request__bulk-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={busy || uploading}
              onClick={() => setMenuOpen((open) => !open)}
            >
              Bulk Upload
            </button>
            {menuOpen ? (
              <div className="camp-program-request__bulk-menu" role="menu">
                <button type="button" role="menuitem" onClick={handleDownloadSample}>
                  Download Sample Template
                </button>
                <button type="button" role="menuitem" onClick={handleUploadData}>
                  Upload Data
                </button>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              className="camp-program-request__file"
              type="file"
              accept={IMPORT_ACCEPT_ATTR}
              onChange={handleUploadFile}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        ) : null}
        <img
          className="camp-program-request__logo"
          src={TYLO_LOGO_SRC}
          alt="TYLO"
          width={140}
          height={40}
          decoding="async"
        />
      </div>
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
              {importMessage ? (
                <div
                  className={importFailed ? 'camp-execute__error' : 'camp-execute__success'}
                  role="status"
                >
                  {importMessage}
                </div>
              ) : null}
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
                  disabled={busy || uploading}
                >
                  {uploading ? 'Uploading…' : busy ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

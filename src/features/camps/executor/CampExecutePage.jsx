import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, Info, MapPin, Trash2, User, FileText, Send,
} from 'lucide-react';
import { campExecuteApi } from './campExecuteApi.js';
import { prepareGpsSelfieForUpload } from '../utils/prepareGpsSelfieForUpload.js';
import './campExecute.css';

const TYLO_LOGO_SRC = '/brand/tylo-logo.jpg';

const STEPS = [
  { id: 'details', label: 'Camp Details' },
  { id: 'documents', label: 'Documents' },
  { id: 'consumables', label: 'Consumables' },
];

const DOC_LABELS = {
  doctor_form: 'Doctor Form (DF)',
  patient_form: 'Patient Form (PF)',
  gps_selfie: 'GPS Selfie (GS)',
};

function readGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => reject(new Error('Allow location access to capture the GPS selfie')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

function applyContext(data, setters) {
  const { setContext, setInTime, setOutTime, setPatients, setProductCount, setConsumables } = setters;
  setContext(data);
  setInTime(data?.form?.inTime || '');
  setOutTime(data?.form?.outTime || '');
  setPatients(
    data?.form?.patientsScreened === '' || data?.form?.patientsScreened == null
      ? ''
      : String(data.form.patientsScreened),
  );
  setProductCount(
    data?.form?.productCount === '' || data?.form?.productCount == null
      ? ''
      : String(data.form.productCount),
  );
  const rows = Array.isArray(data?.form?.consumablesUsed) ? data.form.consumablesUsed : [];
  if (rows.length) {
    setConsumables(rows.map((row) => ({ ...row })));
  } else if (Array.isArray(data?.consumableOptions) && data.consumableOptions.length) {
    setConsumables(data.consumableOptions.map((item) => ({
      productId: item.productId,
      itemName: item.itemName,
      unit: item.unit || '',
      uomId: item.uomId || '',
      quantityUsed: '',
      wastage: '',
    })));
  } else {
    setConsumables([{ productId: '', itemName: '', quantityUsed: '', wastage: '', unit: '', uomId: '' }]);
  }
}

function docForType(documents, type) {
  return (documents || []).find((d) => d.docType === type) || null;
}

export default function CampExecutePage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(0);
  const [context, setContext] = useState(null);
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [patients, setPatients] = useState('');
  const [productCount, setProductCount] = useState('');
  const [consumables, setConsumables] = useState([]);
  const fileRefs = useRef({});

  const locked = Boolean(context?.invite?.locked);
  const camp = context?.camp;

  useEffect(() => {
    let active = true;
    setLoading(true);
    campExecuteApi.load(token)
      .then((data) => {
        if (!active) return;
        applyContext(data, {
          setContext, setInTime, setOutTime, setPatients, setProductCount, setConsumables,
        });
      })
      .catch((err) => {
        if (active) setError(err.message || 'This execution link is unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const draftBody = useMemo(() => ({
    inTime,
    outTime,
    patientsScreened: patients === '' ? '' : Number(patients),
    productCount: productCount === '' ? '' : Number(productCount),
    consumablesUsed: consumables
      .filter((row) => row.itemName || row.productId)
      .map((row) => ({
        ...row,
        productId: row.productId || `free:${String(row.itemName || '').trim().toLowerCase()}`,
      })),
  }), [inTime, outTime, patients, productCount, consumables]);

  const detailsReady = Boolean(String(inTime).trim() && String(outTime).trim()
    && patients !== '' && productCount !== '');

  const docsReady = ['doctor_form', 'patient_form', 'gps_selfie']
    .every((type) => context?.documentStatus?.[type] === 'uploaded');

  async function saveDraft({ silent = false } = {}) {
    setBusy(true);
    setError('');
    if (!silent) setNotice('');
    try {
      const data = await campExecuteApi.saveDraft(token, draftBody);
      applyContext(data, {
        setContext, setInTime, setOutTime, setPatients, setProductCount, setConsumables,
      });
      if (!silent) setNotice('Draft saved');
      return data;
    } catch (err) {
      setError(err.message || 'Could not save draft');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    try {
      if (step === 0 && !detailsReady) {
        setError('Fill In Time, Out Time, Patients Screened, and Product Count');
        return;
      }
      await saveDraft({ silent: true });
      setError('');
      setNotice('');
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch {
      /* error already set */
    }
  }

  async function onUpload(docType, file) {
    if (!file || locked) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveDraft({ silent: true });
      let uploadFile = file;
      let gps = null;
      if (docType === 'gps_selfie') {
        gps = await readGeolocation();
        uploadFile = await prepareGpsSelfieForUpload(file);
      }
      const data = await campExecuteApi.uploadDocument(token, {
        file: uploadFile,
        docType,
        ...(gps || {}),
      });
      applyContext(data, {
        setContext, setInTime, setOutTime, setPatients, setProductCount, setConsumables,
      });
      setNotice(`${DOC_LABELS[docType]} uploaded`);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteDoc(doc) {
    if (!doc || locked) return;
    setBusy(true);
    setError('');
    try {
      const data = await campExecuteApi.deleteDocument(token, doc.fileId || doc.id);
      applyContext(data, {
        setContext, setInTime, setOutTime, setPatients, setProductCount, setConsumables,
      });
    } catch (err) {
      setError(err.message || 'Could not remove document');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!docsReady) {
      setError('Upload Doctor Form, Patient Form, and GPS Selfie before submitting');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await campExecuteApi.submit(token, draftBody);
      applyContext(data, {
        setContext, setInTime, setOutTime, setPatients, setProductCount, setConsumables,
      });
      setNotice('Execution submitted for Camp One review');
    } catch (err) {
      setError(err.message || 'Could not submit execution');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="camp-execute__center">
        <p>Loading camp execution…</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="camp-execute__center">
        <img
          className="camp-execute__center-logo"
          src={TYLO_LOGO_SRC}
          alt="TYLO"
          width={180}
          height={62}
          decoding="async"
        />
        <p>{error || 'This execution link is unavailable.'}</p>
      </div>
    );
  }

  const gps = context.form?.executorGps;

  return (
    <div className="camp-execute">
      <header className="camp-execute__header">
        <button
          type="button"
          className="camp-execute__icon-btn"
          aria-label="Back"
          disabled={step === 0 || locked}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ChevronLeft size={22} />
        </button>
        <div className="camp-execute__brand">
          <img
            className="camp-execute__brand-logo"
            src={TYLO_LOGO_SRC}
            alt="TYLO"
            width={140}
            height={48}
            decoding="async"
          />
          <span>Camp Execution</span>
        </div>
        <button
          type="button"
          className="camp-execute__text-btn"
          disabled={busy || locked}
          onClick={() => saveDraft()}
        >
          {locked ? 'Submitted' : 'Save Draft'}
        </button>
      </header>

      <ol className="camp-execute__steps" aria-label="Progress">
        {STEPS.map((item, index) => {
          const state = index < step ? 'is-done' : index === step ? 'is-active' : '';
          return (
            <li key={item.id} className={`camp-execute__step ${state}`}>
              <span className="camp-execute__step-marker" aria-hidden="true">
                {index < step ? '✓' : index + 1}
              </span>
              <span>{item.label}</span>
            </li>
          );
        })}
      </ol>

      <main className="camp-execute__body">
        {error ? <div className="camp-execute__error" role="alert">{error}</div> : null}
        {locked ? (
          <div className="camp-execute__success" role="status">
            Submitted for Camp One review. The team will Mark Complete separately.
          </div>
        ) : notice ? (
          <div className="camp-execute__success" role="status">{notice}</div>
        ) : null}

        {step === 0 ? (
          <>
            <section className="camp-execute__card">
              <div className="camp-execute__camp-id">
                <strong>{camp.campId}</strong>
                <span className="camp-execute__badge">Execution</span>
              </div>
              <div className="camp-execute__meta">
                <div className="camp-execute__meta-row">
                  <Calendar size={18} aria-hidden="true" color="var(--ce-brand)" />
                  <div>
                    <small>Date</small>
                    <div>{camp.campDateLabel || camp.campDate}</div>
                  </div>
                </div>
                <div className="camp-execute__meta-row">
                  <User size={18} aria-hidden="true" color="var(--ce-brand)" />
                  <div>
                    <small>Doctor</small>
                    <div>{camp.doctorName || '—'}</div>
                  </div>
                </div>
                <div className="camp-execute__meta-row">
                  <MapPin size={18} aria-hidden="true" color="var(--ce-brand)" />
                  <div>
                    <small>Clinic</small>
                    <div>{camp.clinicLabel || camp.clinicAddress || '—'}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="camp-execute__card">
              <h2 className="camp-execute__section-title">Execution Information</h2>
              <div className="camp-execute__fields">
                <div className="camp-execute__field">
                  <label htmlFor="ce-in">In Time <span className="req">*</span></label>
                  <input
                    id="ce-in"
                    type="time"
                    value={inTime}
                    disabled={locked || busy}
                    onChange={(e) => setInTime(e.target.value)}
                  />
                </div>
                <div className="camp-execute__field">
                  <label htmlFor="ce-out">Out Time <span className="req">*</span></label>
                  <input
                    id="ce-out"
                    type="time"
                    value={outTime}
                    disabled={locked || busy}
                    onChange={(e) => setOutTime(e.target.value)}
                  />
                </div>
                <div className="camp-execute__field">
                  <label htmlFor="ce-patients">Patients Screened <span className="req">*</span></label>
                  <input
                    id="ce-patients"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={patients}
                    disabled={locked || busy}
                    onChange={(e) => setPatients(e.target.value)}
                  />
                </div>
                <div className="camp-execute__field">
                  <label htmlFor="ce-rx">Product Count <span className="req">*</span></label>
                  <input
                    id="ce-rx"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={productCount}
                    disabled={locked || busy}
                    onChange={(e) => setProductCount(e.target.value)}
                  />
                </div>
              </div>
            </section>
          </>
        ) : null}

        {step === 1 ? (
          <section className="camp-execute__card">
            <h2 className="camp-execute__section-title">Upload Documents</h2>
            {['doctor_form', 'patient_form', 'gps_selfie'].map((type) => {
              const uploaded = docForType(context.documents, type);
              const status = context.documentStatus?.[type] === 'uploaded' ? 'uploaded' : 'required';
              return (
                <div key={type} className="camp-execute__doc">
                  <div className="camp-execute__doc-head">
                    <strong>
                      {DOC_LABELS[type]}
                      {' '}
                      <span className="req">*</span>
                    </strong>
                    <span className={`camp-execute__status ${status === 'uploaded' ? 'is-ok' : 'is-req'}`}>
                      {status === 'uploaded' ? 'Uploaded' : 'Required'}
                    </span>
                  </div>
                  {uploaded ? (
                    <div className="camp-execute__file">
                      {type === 'gps_selfie' && uploaded.url ? (
                        <img src={uploaded.url} alt="GPS selfie" />
                      ) : (
                        <FileText size={22} aria-hidden="true" color="var(--ce-brand)" />
                      )}
                      <div className="camp-execute__file-meta">
                        <strong>{uploaded.fileName}</strong>
                        <span>{type === 'gps_selfie' ? 'Image' : 'Document'}</span>
                      </div>
                      {!locked ? (
                        <button
                          type="button"
                          className="camp-execute__icon-btn"
                          aria-label="Remove"
                          disabled={busy}
                          onClick={() => onDeleteDoc(uploaded)}
                        >
                          <Trash2 size={18} color="var(--ce-danger)" />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <input
                        ref={(el) => { fileRefs.current[type] = el; }}
                        type="file"
                        accept={type === 'gps_selfie' ? 'image/*' : 'application/pdf,image/*'}
                        capture={type === 'gps_selfie' ? 'environment' : undefined}
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) onUpload(type, file);
                        }}
                      />
                      <button
                        type="button"
                        className="camp-execute__upload-btn"
                        disabled={busy || locked}
                        onClick={() => fileRefs.current[type]?.click()}
                      >
                        {type === 'gps_selfie' ? 'Capture / Upload GPS Selfie' : 'Upload file'}
                      </button>
                    </>
                  )}
                  {type === 'gps_selfie' && gps?.latitude != null ? (
                    <div className="camp-execute__gps">
                      <span>
                        Location captured:
                        {' '}
                        {Number(gps.latitude).toFixed(4)}
                        ,
                        {' '}
                        {Number(gps.longitude).toFixed(4)}
                      </span>
                      {gps.withinRadius === true ? (
                        <span className="camp-execute__badge">Within {context.gps?.radiusMeters || 250} m</span>
                      ) : null}
                      {gps.withinRadius === false ? (
                        <span className="camp-execute__status is-req">
                          Outside {context.gps?.radiusMeters || 250} m
                          {gps.distanceMeters != null ? ` (${gps.distanceMeters} m)` : ''}
                        </span>
                      ) : null}
                      {gps.withinRadius == null ? (
                        <span className="camp-execute__badge is-warn">Clinic GPS not set — location saved</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="camp-execute__card">
            <h2 className="camp-execute__section-title">Consumables Used</h2>
            <div className="camp-execute__info">
              <Info size={18} aria-hidden="true" />
              <span>Enter only items used during the camp.</span>
            </div>
            <div className="camp-execute__cons-list">
              {consumables.map((row, index) => {
                const unitLabel = String(row.unit || '').trim();
                return (
                  <article className="camp-execute__cons-card" key={`${row.productId || 'row'}-${index}`}>
                    <div className="camp-execute__cons-card-top">
                      <span className="camp-execute__cons-card-title">
                        {row.itemName?.trim() || `Item ${index + 1}`}
                      </span>
                      {!locked ? (
                        <button
                          type="button"
                          className="camp-execute__icon-btn camp-execute__icon-btn--danger"
                          aria-label="Remove item"
                          onClick={() => setConsumables((rows) => (
                            rows.length <= 1
                              ? [{ productId: '', itemName: '', quantityUsed: '', wastage: '', unit: '', uomId: '' }]
                              : rows.filter((_, i) => i !== index)
                          ))}
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : null}
                    </div>

                    <label className="camp-execute__cons-field">
                      <span>Item</span>
                      {context.consumableOptions?.length ? (
                        <select
                          value={row.productId || ''}
                          disabled={locked || busy}
                          onChange={(e) => {
                            const opt = context.consumableOptions.find((o) => o.productId === e.target.value);
                            setConsumables((rows) => rows.map((r, i) => (
                              i === index
                                ? {
                                  ...r,
                                  productId: opt?.productId || '',
                                  itemName: opt?.itemName || '',
                                  unit: opt?.unit || '',
                                  uomId: opt?.uomId || '',
                                }
                                : r
                            )));
                          }}
                        >
                          <option value="">Select item</option>
                          {context.consumableOptions.map((opt) => (
                            <option key={opt.productId} value={opt.productId}>{opt.itemName}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={row.itemName || ''}
                          disabled={locked || busy}
                          placeholder="Item name"
                          onChange={(e) => {
                            const name = e.target.value;
                            setConsumables((rows) => rows.map((r, i) => (
                              i === index
                                ? { ...r, itemName: name, productId: name ? `free:${name.trim().toLowerCase()}` : '' }
                                : r
                            )));
                          }}
                        />
                      )}
                    </label>

                    <div className="camp-execute__cons-qty-row">
                      <label className="camp-execute__cons-field">
                        <span>
                          Used
                          {unitLabel ? ` (${unitLabel})` : ''}
                          {' '}
                          <span className="req">*</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={row.quantityUsed}
                          disabled={locked || busy}
                          placeholder="0"
                          onChange={(e) => {
                            const value = e.target.value;
                            setConsumables((rows) => rows.map((r, i) => (
                              i === index ? { ...r, quantityUsed: value } : r
                            )));
                          }}
                        />
                      </label>
                      <label className="camp-execute__cons-field">
                        <span>
                          Wastage
                          {unitLabel ? ` (${unitLabel})` : ''}
                        </span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={row.wastage}
                          disabled={locked || busy}
                          placeholder="0"
                          onChange={(e) => {
                            const value = e.target.value;
                            setConsumables((rows) => rows.map((r, i) => (
                              i === index ? { ...r, wastage: value } : r
                            )));
                          }}
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
            {!locked ? (
              <button
                type="button"
                className="camp-execute__add-btn"
                disabled={busy}
                onClick={() => setConsumables((rows) => [
                  ...rows,
                  { productId: '', itemName: '', quantityUsed: '', wastage: '', unit: '', uomId: '' },
                ])}
              >
                + Add Another Item
              </button>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="camp-execute__footer">
        {step > 0 ? (
          <button
            type="button"
            className="camp-execute__btn secondary"
            disabled={busy}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft size={18} /> Back
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="camp-execute__btn primary"
            disabled={busy || locked}
            onClick={goNext}
          >
            Next <ChevronRight size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="camp-execute__btn primary"
            disabled={busy || locked || !docsReady || !detailsReady}
            onClick={onSubmit}
          >
            <Send size={18} /> Submit Execution
          </button>
        )}
      </footer>
    </div>
  );
}

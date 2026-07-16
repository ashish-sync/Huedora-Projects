import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiFetch } from '../../shared/api.js';

import { MODULE, FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function firstDayOfMonth(periodKey = currentPeriod()) {
  return `${periodKey}-01`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function periodKeyFromIso(iso) {
  if (!iso || iso.length < 7) return currentPeriod();
  return iso.slice(0, 7);
}

function toneFor(condition) {
  if (condition === 'SAFE') return 'ok';
  if (condition === 'CAUTION') return 'warn';
  return 'danger';
}

function labelFor(condition) {
  if (condition === 'SAFE') return 'Safe';
  if (condition === 'CAUTION') return 'Caution';
  return 'Danger';
}

function actionLabel(action) {
  const map = {
    MANUAL_VERIFY: 'Manual verification',
    LINK_SENT: 'Link sent',
    SELF_VERIFY: 'Self-verification',
    LINK_CANCELLED: 'Link cancelled',
    CALL_ATTEMPT: 'Call attempt',
  };
  return map[action] || action;
}

const CALL_OUTCOME_OPTIONS = [
  { value: 'NO_RESPONSE', label: 'No response' },
  { value: 'CALLBACK_LATER', label: 'Callback later' },
  { value: 'WRONG_NUMBER', label: 'Wrong number' },
  { value: 'OTHER', label: 'Other' },
];

function toDatetimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function readGps() {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not available in this browser');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(new Error(err.message || 'Could not read GPS location')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

export default function VerificationsPage() {
  const { can } = useAuth();
  const canWrite = can('verifications:write') || can('*');
  const [fromDate, setFromDate] = useState(() => firstDayOfMonth());
  const [toDate, setToDate] = useState(() => todayIso());
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [verifyStep, setVerifyStep] = useState(null);
  const [photoFull, setPhotoFull] = useState(null);
  const [previewFull, setPreviewFull] = useState('');
  const [photoSerial, setPhotoSerial] = useState(null);
  const [previewSerial, setPreviewSerial] = useState('');
  const [extraPhotos, setExtraPhotos] = useState([]); // [{ file, preview }]
  const [gps, setGps] = useState(null);
  const [physical, setPhysical] = useState('PASS');
  const [functionality, setFunctionality] = useState('CHECKED');
  const [callRemark, setCallRemark] = useState('');
  const [callOutcome, setCallOutcome] = useState('NO_RESPONSE');
  const [callNote, setCallNote] = useState('');
  const [callbackAtLocal, setCallbackAtLocal] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [zone, setZone] = useState('');
  const [custodianName, setCustodianName] = useState('');
  const [custodianContact, setCustodianContact] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkValidDays, setLinkValidDays] = useState(7);
  const [linkExpiresAt, setLinkExpiresAt] = useState('');
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const fullRef = useRef(null);
  const serialRef = useRef(null);
  const extraRef = useRef(null);

  const periodKey = periodKeyFromIso(toDate);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (fromDate && toDate && fromDate > toDate) {
        throw new Error('From date must be on or before To date');
      }
      const activePeriod = periodKeyFromIso(toDate);
      const params = new URLSearchParams({ periodKey: activePeriod });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (filter) params.set('condition', filter);
      const { data } = await api(`/verifications/board?${params}`);
      setBoard(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = board?.rows || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) => {
      const a = r.asset || {};
      const h = r.holder || {};
      return [a.deviceNameSnapshot, a.serialNumber, a.assetTag, a.custody, h.name, h.city]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(needle));
    });
  }, [board, q]);

  const counts = board?.counts || { SAFE: 0, CAUTION: 0, DANGER: 0 };

  const loadActivity = async (recordId) => {
    try {
      const { data } = await api(`/verifications/records/${recordId}/activity`);
      setActivity(data || []);
    } catch {
      setActivity([]);
    }
  };

  const clearPhotoPreviews = () => {
    if (previewFull) URL.revokeObjectURL(previewFull);
    if (previewSerial) URL.revokeObjectURL(previewSerial);
    extraPhotos.forEach((p) => {
      if (p.preview) URL.revokeObjectURL(p.preview);
    });
  };

  const resetForm = (row) => {
    clearPhotoPreviews();
    setPhotoFull(null);
    setPreviewFull('');
    setPhotoSerial(null);
    setPreviewSerial('');
    setExtraPhotos([]);
    setGps(null);
    setPhysical('PASS');
    setFunctionality('CHECKED');
    setCallRemark(row?.record?.callRemark || '');
    setCallOutcome('NO_RESPONSE');
    setCallNote('');
    setCallbackAtLocal('');
    setCurrentLocation('');
    setZone('');
    setCustodianName(row?.holder?.name || '');
    setCustodianContact(row?.holder?.phone || row?.holder?.email || '');
    setLinkUrl('');
    setLinkValidDays(7);
    setLinkExpiresAt('');
    if (fullRef.current) fullRef.current.value = '';
    if (serialRef.current) serialRef.current.value = '';
    if (extraRef.current) extraRef.current.value = '';
  };

  const openVerify = (row) => {
    if (!row.condition?.nextRound) {
      setMsg('Both monthly verifications are already complete for this asset.');
      return;
    }
    setActive(row);
    setVerifyStep('choose');
    resetForm(row);
    setError('');
    setMsg('');
    loadActivity(row.record._id);
  };

  const closeVerify = () => {
    setActive(null);
    setVerifyStep(null);
    setActivity([]);
    resetForm(null);
  };

  const onPickRequiredPhoto = (slot, file) => {
    if (slot === 'full') {
      if (previewFull) URL.revokeObjectURL(previewFull);
      setPhotoFull(file || null);
      setPreviewFull(file ? URL.createObjectURL(file) : '');
    } else {
      if (previewSerial) URL.revokeObjectURL(previewSerial);
      setPhotoSerial(file || null);
      setPreviewSerial(file ? URL.createObjectURL(file) : '');
    }
  };

  const addExtraPhotos = (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setExtraPhotos((prev) => [
      ...prev,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    if (extraRef.current) extraRef.current.value = '';
  };

  const removeExtraPhoto = (idx) => {
    setExtraPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const captureGps = async () => {
    setGpsBusy(true);
    setError('');
    try {
      setGps(await readGps());
    } catch (e) {
      setError(e.message);
    } finally {
      setGpsBusy(false);
    }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (!active?.record?._id || !active.condition?.nextRound) return;
    if (!photoFull) {
      setError('Upload a full device photo');
      return;
    }
    if (!photoSerial) {
      setError('Upload a device photo with the serial number visible');
      return;
    }
    if (!gps) {
      setError('Capture GPS location before submitting');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('photoFull', photoFull);
      fd.append('photoSerial', photoSerial);
      for (const item of extraPhotos) {
        if (item.file) fd.append('photosExtra', item.file);
      }
      fd.append('latitude', String(gps.latitude));
      fd.append('longitude', String(gps.longitude));
      if (gps.accuracy != null) fd.append('accuracy', String(gps.accuracy));
      fd.append('physical', physical);
      fd.append('functionality', functionality);
      if (callRemark.trim()) fd.append('callRemark', callRemark.trim());
      if (currentLocation.trim()) fd.append('currentLocation', currentLocation.trim());
      if (zone.trim()) fd.append('zone', zone.trim());
      if (custodianName.trim()) fd.append('custodianName', custodianName.trim());
      if (custodianContact.trim()) fd.append('custodianContact', custodianContact.trim());

      const res = await apiFetch(
        `/verifications/records/${active.record._id}/rounds/${active.condition.nextRound}`,
        {
          method: 'POST',
          body: fd,
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || 'Verification failed');

      setMsg(
        `Round ${active.condition.nextRound} saved for ${active.asset.deviceNameSnapshot || active.asset.serialNumber}.`
      );
      closeVerify();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async () => {
    if (!active?.record?._id || !active.condition?.nextRound) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api(`/verifications/records/${active.record._id}/send-link`, {
        method: 'POST',
        body: {
          round: active.condition.nextRound,
          validForDays: Number(linkValidDays),
        },
      });
      const url = `${window.location.origin}/v/${data.invite.shortCode}`;
      setLinkUrl(url);
      setLinkExpiresAt(data.invite.expiresAt || '');
      setMsg(
        `Verification link sent for Round ${active.condition.nextRound} (valid ${linkValidDays} day${
          Number(linkValidDays) === 1 ? '' : 's'
        }).`
      );
      await loadActivity(active.record._id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCallAttempt = async (e) => {
    e.preventDefault();
    if (!active?.record?._id || !active.condition?.nextRound) return;
    if (callOutcome === 'OTHER' && !callNote.trim()) {
      setError('Add a note when outcome is Other');
      return;
    }
    let callbackAtIso;
    if (callOutcome === 'CALLBACK_LATER') {
      if (!callbackAtLocal) {
        setError('Pick a callback date and time');
        return;
      }
      const due = new Date(callbackAtLocal);
      if (Number.isNaN(due.getTime())) {
        setError('Invalid callback date and time');
        return;
      }
      if (due.getTime() <= Date.now()) {
        setError('Callback reminder must be in the future');
        return;
      }
      callbackAtIso = due.toISOString();
    }

    setBusy(true);
    setError('');
    try {
      const { data } = await api(`/verifications/records/${active.record._id}/call-attempt`, {
        method: 'POST',
        body: {
          round: active.condition.nextRound,
          outcome: callOutcome,
          note: callNote.trim() || undefined,
          callbackAt: callbackAtIso,
        },
      });
      setCallRemark(data?.callRemark || '');
      setCallNote('');
      setCallbackAtLocal('');
      setMsg(
        callOutcome === 'CALLBACK_LATER'
          ? 'Call attempt saved. Reminder will appear in Notifications at the scheduled time.'
          : 'Call attempt saved.'
      );
      await loadActivity(active.record._id);
      await load();
      setActive((prev) =>
        prev
          ? {
              ...prev,
              record: {
                ...prev.record,
                callRemark: data?.callRemark || prev.record.callRemark,
                callbackAt: data?.callbackAt ?? prev.record.callbackAt,
              },
            }
          : prev
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setMsg('Verification link copied to clipboard');
    } catch {
      setError('Could not copy link');
    }
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }]}
      title={MODULE.ASSET_VERIFICATION}
      kpis={[
        { key: 'SAFE', label: 'Safe', value: counts.SAFE || 0, active: filter === 'SAFE', onClick: () => setFilter(filter === 'SAFE' ? '' : 'SAFE') },
        { key: 'CAUTION', label: 'Caution', value: counts.CAUTION || 0, active: filter === 'CAUTION', onClick: () => setFilter(filter === 'CAUTION' ? '' : 'CAUTION') },
        { key: 'DANGER', label: 'Danger', value: counts.DANGER || 0, active: filter === 'DANGER', onClick: () => setFilter(filter === 'DANGER' ? '' : 'DANGER') },
        { key: 'ALL', label: 'Signed assets', value: (board?.rows || []).length },
      ]}
      toolbar={
        <div className="vf-filters">
          <label className="vf-date-field">
            <span>From</span>
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="vf-date-field">
            <span>To</span>
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <button className="btn secondary vf-search-btn" type="button" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Search'}
          </button>
          <span className="muted mono-sm vf-period-hint">
            {board?.periodKey || periodKey}
          </span>
        </div>
      }
    >
      {error && !active && (
        <div className="am-banner is-error" role="alert">
          {error}
        </div>
      )}
      {msg && !active && (
        <div className="am-banner is-info" role="status">
          {msg}
        </div>
      )}

      {active && canWrite && (
        <div className="vf-modal-backdrop" role="presentation" onClick={closeVerify}>
          <div
            className={`vf-modal card${verifyStep === 'choose' ? ' is-compact' : ''}`}
            role="dialog"
            aria-labelledby="vf-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vf-verify-head">
              <div>
                <h2 id="vf-modal-title">
                  {verifyStep === 'choose'
                    ? 'Verify'
                    : verifyStep === 'call'
                      ? 'Log call attempt'
                      : `Round ${active.condition.nextRound} · ${active.asset.deviceNameSnapshot || 'Asset'}`}
                </h2>
                <p className="muted">
                  {active.asset.serialNumber || '—'}
                  {active.holder?.name ? ` · ${active.holder.name}` : ''}
                </p>
              </div>
              <button type="button" className="btn secondary btn-compact" onClick={closeVerify}>
                Close
              </button>
            </div>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            {verifyStep === 'choose' && (
              <div className="vf-choose-list">
                <button type="button" className="vf-choose-btn" onClick={() => setVerifyStep('manual')}>
                  Verify Manually
                </button>
                <button
                  type="button"
                  className="vf-choose-btn"
                  onClick={() => setVerifyStep('link')}
                  disabled={!active.holder}
                  title={active.holder ? undefined : 'Assign a custodian in Asset Registry first'}
                >
                  Send link to Holder
                </button>
                <button type="button" className="vf-choose-btn" onClick={() => setVerifyStep('call')}>
                  Log call attempt
                </button>
                {!active.holder && (
                  <p className="muted vf-choose-hint">Assign a custodian before sending a link.</p>
                )}
              </div>
            )}

            {verifyStep === 'call' && (
              <form className="vf-link-panel" onSubmit={submitCallAttempt}>
                <button type="button" className="btn secondary btn-compact vf-back" onClick={() => setVerifyStep('choose')}>
                  <span className="vf-back-icon" aria-hidden="true">←</span>
                  Back
                </button>
                {callRemark && (
                  <div className="vf-link-holder">
                    <span className="sv-label">Last call remark</span>
                    <span>{callRemark}</span>
                  </div>
                )}
                <div className="field">
                  <label>Outcome</label>
                  <select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)}>
                    {CALL_OUTCOME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {callOutcome === 'CALLBACK_LATER' && (
                  <div className="field">
                    <label>Callback date &amp; time *</label>
                    <input
                      type="datetime-local"
                      value={callbackAtLocal}
                      min={toDatetimeLocalValue(new Date(Date.now() + 60_000))}
                      onChange={(e) => setCallbackAtLocal(e.target.value)}
                      required
                    />
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.8rem' }}>
                      A reminder will appear under Notifications at this time.
                    </p>
                  </div>
                )}
                <div className="field">
                  <label>{callOutcome === 'OTHER' ? 'Note *' : 'Note'}</label>
                  <textarea
                    value={callNote}
                    onChange={(e) => setCallNote(e.target.value)}
                    rows={3}
                    placeholder={
                      callOutcome === 'CALLBACK_LATER'
                        ? 'e.g. try after 5pm'
                        : callOutcome === 'OTHER'
                          ? 'Describe the call result'
                          : 'Optional detail'
                    }
                  />
                </div>
                <div className="vf-verify-actions">
                  <button className="btn" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save call attempt'}
                  </button>
                </div>
              </form>
            )}

            {verifyStep === 'manual' && (
              <form className="vf-verify-form" onSubmit={submitManual}>
                <button type="button" className="btn secondary btn-compact vf-back" onClick={() => setVerifyStep('choose')}>
                  <span className="vf-back-icon" aria-hidden="true">←</span>
                  Back
                </button>

                <section className="vf-form-section">
                  <div className="vf-form-section-head">
                    <h3>Photos</h3>
                    <p className="muted">Full device and serial photos are required. Extra photos are optional.</p>
                  </div>
                  <div className="vf-photo-pair">
                    <div className="field">
                      <label>Full device photo *</label>
                      <p className="muted vf-photo-hint">Entire device in frame, clearly visible.</p>
                      <input
                        ref={fullRef}
                        className="vf-file-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        required
                        onChange={(e) => onPickRequiredPhoto('full', e.target.files?.[0] || null)}
                      />
                      {previewFull && (
                        <img src={previewFull} alt="Full device preview" className="vf-photo-preview" />
                      )}
                    </div>
                    <div className="field">
                      <label>Serial number photo *</label>
                      <p className="muted vf-photo-hint">Close-up where the serial can be read.</p>
                      <input
                        ref={serialRef}
                        className="vf-file-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        required
                        onChange={(e) => onPickRequiredPhoto('serial', e.target.files?.[0] || null)}
                      />
                      {previewSerial && (
                        <img
                          src={previewSerial}
                          alt="Serial number preview"
                          className="vf-photo-preview"
                        />
                      )}
                    </div>
                  </div>
                  <div className="field">
                    <label>Additional photos</label>
                    <p className="muted vf-photo-hint">Optional. Add damage, packaging, or other views.</p>
                    <input
                      ref={extraRef}
                      className="vf-file-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={(e) => addExtraPhotos(e.target.files)}
                    />
                    {extraPhotos.length > 0 && (
                      <div className="vf-photo-extra-grid">
                        {extraPhotos.map((item, idx) => (
                          <div key={`${item.preview}-${idx}`} className="vf-photo-extra-item">
                            <img src={item.preview} alt={`Extra ${idx + 1}`} className="vf-photo-preview" />
                            <button
                              type="button"
                              className="btn secondary btn-compact"
                              onClick={() => removeExtraPhoto(idx)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="vf-form-section">
                  <div className="vf-form-section-head">
                    <h3>Location</h3>
                    <p className="muted">Capture GPS at the verification site.</p>
                  </div>
                  <div className="field">
                    <label>GPS *</label>
                    <div className="vf-gps-box">
                      <button type="button" className="btn secondary" disabled={gpsBusy} onClick={captureGps}>
                        {gpsBusy ? 'Locating…' : gps ? 'Refresh GPS' : 'Capture GPS'}
                      </button>
                      {gps ? (
                        <code className="mono-sm vf-gps-coords">
                          {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
                        </code>
                      ) : (
                        <span className="muted">Not captured</span>
                      )}
                    </div>
                  </div>
                </section>

                <section className="vf-form-section">
                  <div className="vf-form-section-head">
                    <h3>Condition</h3>
                  </div>
                  <div className="vf-verify-grid">
                    <div className="field">
                      <label>Physical condition</label>
                      <select value={physical} onChange={(e) => setPhysical(e.target.value)}>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Functionality</label>
                      <select value={functionality} onChange={(e) => setFunctionality(e.target.value)}>
                        <option value="CHECKED">Checked</option>
                        <option value="NOT_CHECKED">Not checked</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="vf-form-section">
                  <div className="vf-form-section-head">
                    <h3>Custodian &amp; place</h3>
                  </div>
                  <div className="vf-verify-grid">
                    <div className="field">
                      <label>Custodian name</label>
                      <input
                        value={custodianName}
                        onChange={(e) => setCustodianName(e.target.value)}
                        placeholder="Who has the device"
                      />
                    </div>
                    <div className="field">
                      <label>Custodian contact</label>
                      <input
                        value={custodianContact}
                        onChange={(e) => setCustodianContact(e.target.value)}
                        placeholder="Phone or email"
                      />
                    </div>
                    <div className="field">
                      <label>Current location</label>
                      <input
                        value={currentLocation}
                        onChange={(e) => setCurrentLocation(e.target.value)}
                        placeholder="City or site"
                      />
                    </div>
                    <div className="field">
                      <label>Zone / area</label>
                      <input
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="field vf-span-2">
                      <label>Remarks</label>
                      <textarea
                        value={callRemark}
                        onChange={(e) => setCallRemark(e.target.value)}
                        rows={2}
                        placeholder="Optional notes from this check"
                      />
                    </div>
                  </div>
                </section>

                <div className="vf-verify-actions">
                  <button className="btn" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : `Submit Round ${active.condition.nextRound}`}
                  </button>
                </div>
              </form>
            )}

            {verifyStep === 'link' && (
              <div className="vf-link-panel">
                <button type="button" className="btn secondary btn-compact vf-back" onClick={() => setVerifyStep('choose')}>
                  <span className="vf-back-icon" aria-hidden="true">←</span>
                  Back
                </button>
                <div className="vf-link-holder">
                  <span className="sv-label">Asset holder</span>
                  <strong>{active.holder?.name}</strong>
                  <span className="muted">
                    {[active.holder?.email, active.holder?.phone, active.holder?.city].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {active.pendingLink && !linkUrl && (
                  <p className="muted">
                    Link already sent{' '}
                    {active.pendingLink.sentAt
                      ? new Date(active.pendingLink.sentAt).toLocaleString()
                      : ''}
                    {active.pendingLink.expiresAt
                      ? ` · expires ${new Date(active.pendingLink.expiresAt).toLocaleString()}`
                      : ''}
                    . Generate a new link below to replace it.
                  </p>
                )}
                <div className="field vf-link-validity">
                  <label htmlFor="vf-link-valid-days">Link valid for</label>
                  <select
                    id="vf-link-valid-days"
                    value={linkValidDays}
                    onChange={(e) => setLinkValidDays(Number(e.target.value))}
                    disabled={busy}
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
                <div className="vf-verify-actions">
                  <button className="btn" type="button" disabled={busy} onClick={sendLink}>
                    {busy ? 'Sending…' : linkUrl ? 'Regenerate link' : 'Generate secure link'}
                  </button>
                </div>
                {linkUrl && (
                  <div className="vf-link-copy">
                    <code className="mono-sm">{linkUrl}</code>
                    <button type="button" className="btn secondary btn-compact" onClick={copyLink}>
                      Copy link
                    </button>
                  </div>
                )}
                <p className="muted vf-link-expiry">
                  {linkExpiresAt
                    ? `Expires ${new Date(linkExpiresAt).toLocaleString()} (${linkValidDays} day${
                        Number(linkValidDays) === 1 ? '' : 's'
                      }).`
                    : `Link will expire after ${linkValidDays} day${
                        Number(linkValidDays) === 1 ? '' : 's'
                      }.`}
                </p>
              </div>
            )}

            {activity.length > 0 && (
              <div className="vf-activity">
                <p className="section-label">Audit trail</p>
                <ul className="vf-activity-list">
                  {activity.map((a) => (
                    <li key={a._id}>
                      <strong>{actionLabel(a.action)}</strong>
                      <span className="muted">{a.message}</span>
                      <span className="mono-sm muted">
                        {a.actorName || a.actorEmail || 'System'} · {new Date(a.at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <section className="vf-catalog card">
        <div className="vf-toolbar">
          <input
            className="esign-search"
            placeholder="Search asset, serial, custodian, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search verification board"
          />
          {filter && (
            <button type="button" className="filter-chip" onClick={() => setFilter('')}>
              {labelFor(filter)}
              <span aria-hidden="true">×</span>
            </button>
          )}
          <button className="btn secondary" type="button" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="vf-table-wrap">
          <table className="vf-table">
            <thead>
              <tr>
                <th>Condition</th>
                <th>{FIELD.ASSET_NAME}</th>
                <th>Serial</th>
                <th>Custodian</th>
                <th>Rounds</th>
                <th>Last verified</th>
                <th>Reason</th>
                {canWrite && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.asset._id}>
                  <td>
                    <span className={`badge tone-${toneFor(row.condition.condition)}`}>
                      {labelFor(row.condition.condition)}
                    </span>
                  </td>
                  <td>
                    <div className="vf-device-cell">
                      <strong>{row.asset.deviceNameSnapshot || '—'}</strong>
                      <span className="muted mono-sm">{row.asset.assetTag}</span>
                    </div>
                  </td>
                  <td className="mono-sm">{row.asset.serialNumber || '—'}</td>
                  <td>
                    <div>{row.holder?.name || '—'}</div>
                    {row.holder?.city && <span className="muted mono-sm">{row.holder.city}</span>}
                  </td>
                  <td>
                    <span className="vf-rounds">
                      <span className={row.condition.round1Done ? 'is-done' : ''}>R1</span>
                      <span className={row.condition.round2Done ? 'is-done' : ''}>R2</span>
                    </span>
                    {row.pendingLink && (
                      <span className="badge tone-info" style={{ marginLeft: 6 }}>
                        Link sent
                      </span>
                    )}
                  </td>
                  <td className="mono-sm">
                    {row.condition.lastVerifiedAt
                      ? new Date(row.condition.lastVerifiedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="muted vf-reason">{row.condition.reason}</td>
                  {canWrite && (
                    <td>
                      {row.condition.nextRound ? (
                        <button type="button" className="btn btn-compact" onClick={() => openVerify(row)}>
                          Verify
                        </button>
                      ) : (
                        <span className="badge tone-ok">Done</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={canWrite ? 8 : 7}>
                    <div className="vf-empty">
                      <strong>No Agreement Signed assets</strong>
                      <p className="muted">
                        Set status to “Agreement Signed” in {MODULE.ASSET_INVENTORY} and assign custodians
                        from {MODULE.CONTACT_DIRECTORY}.
                      </p>
                      <Link className="btn secondary" to="/assets">
                        Open {MODULE.ASSET_INVENTORY}
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}

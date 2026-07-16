import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiUrl } from '../../shared/api.js';

const SENDER_ORG = 'Tylo Care';

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

export default function SelfVerifyPage() {
  const { token } = useParams();
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [photoFull, setPhotoFull] = useState(null);
  const [previewFull, setPreviewFull] = useState('');
  const [photoSerial, setPhotoSerial] = useState(null);
  const [previewSerial, setPreviewSerial] = useState('');
  const [extraPhotos, setExtraPhotos] = useState([]);
  const [gps, setGps] = useState(null);
  const [physical, setPhysical] = useState('PASS');
  const [functionality, setFunctionality] = useState('CHECKED');
  const [currentLocation, setCurrentLocation] = useState('');
  const [zone, setZone] = useState('');
  const [callRemark, setCallRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const fullRef = useRef(null);
  const serialRef = useRef(null);
  const extraRef = useRef(null);

  useEffect(() => {
    fetch(apiUrl(`/self-verify/${token}`))
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j?.error?.message || 'Invalid verification link');
        setCtx(j.data);
        setCurrentLocation(j.data?.record?.currentLocation || '');
        setZone(j.data?.record?.zone || '');
        setCallRemark(j.data?.record?.callRemark || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(
    () => () => {
      if (previewFull) URL.revokeObjectURL(previewFull);
      if (previewSerial) URL.revokeObjectURL(previewSerial);
      extraPhotos.forEach((p) => {
        if (p.preview) URL.revokeObjectURL(p.preview);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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

  const submit = async (e) => {
    e.preventDefault();
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
      if (currentLocation.trim()) fd.append('currentLocation', currentLocation.trim());
      if (zone.trim()) fd.append('zone', zone.trim());
      if (callRemark.trim()) fd.append('callRemark', callRemark.trim());

      const res = await fetch(apiUrl(`/self-verify/${token}`), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || 'Verification failed');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="sv-page">
        <div className="sv-card">
          <p className="muted">Loading verification…</p>
        </div>
      </div>
    );
  }

  if (error && !ctx) {
    return (
      <div className="sv-page">
        <header className="sv-header">
          <strong>{SENDER_ORG}</strong>
          <span>Asset verification</span>
        </header>
        <div className="sv-card sv-error">
          <h1>Link unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="sv-page">
        <header className="sv-header">
          <strong>{SENDER_ORG}</strong>
          <span>Asset verification</span>
        </header>
        <div className="sv-card sv-success">
          <h1>Verification submitted</h1>
          <p>
            Round {ctx?.round} for <strong>{ctx?.asset?.name}</strong> was recorded successfully.
            You may close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <header className="sv-header">
        <div>
          <strong>{SENDER_ORG}</strong>
          <span>Secure asset verification · Round {ctx?.round}</span>
        </div>
        <span className="sv-badge">Protected link</span>
      </header>

      <main className="sv-main">
        <div className="sv-card">
          <h1>Verify your asset</h1>
          <p className="muted">
            Hello {ctx?.holder?.name || 'there'}. Confirm the asset condition and upload the required
            photos with GPS.
          </p>

          <div className="sv-asset-summary">
            <div>
              <span className="sv-label">Asset</span>
              <strong>{ctx?.asset?.name}</strong>
            </div>
            <div>
              <span className="sv-label">Serial</span>
              <span className="mono-sm">{ctx?.asset?.serialNumber || '—'}</span>
            </div>
            <div>
              <span className="sv-label">Period</span>
              <span>{ctx?.periodKey}</span>
            </div>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <form className="sv-form" onSubmit={submit}>
            <section className="vf-form-section">
              <div className="vf-form-section-head">
                <h3>Photos</h3>
                <p className="muted">Full device and serial photos are required.</p>
              </div>
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
                  <img src={previewFull} alt="Full device preview" className="sv-photo-preview" />
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
                  <img src={previewSerial} alt="Serial number preview" className="sv-photo-preview" />
                )}
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
                        <img src={item.preview} alt={`Extra ${idx + 1}`} className="sv-photo-preview" />
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
                <h3>Condition &amp; place</h3>
              </div>
              <div className="sv-form-grid">
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
                  <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Optional" />
                </div>
              </div>

              <div className="field">
                <label>Remarks</label>
                <textarea
                  rows={3}
                  value={callRemark}
                  onChange={(e) => setCallRemark(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </section>

            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : `Submit Round ${ctx?.round || ''} verification`}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

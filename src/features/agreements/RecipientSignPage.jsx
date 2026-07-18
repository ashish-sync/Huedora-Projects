import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, apiUrl } from '../../shared/api.js';

const SENDER_ORG = 'Tylo Care';

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

function isLikelyMobile() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
}

function PageChrome({ children }) {
  return (
    <div className="rs-page">
      <header className="rs-header">
        <div className="rs-header-brand">
          <span className="rs-logo">{SENDER_ORG}</span>
          <span className="rs-header-tag">Document signing</span>
        </div>
          <span className="rs-header-badge" aria-label="Secure link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Secure link
          </span>
      </header>
      {children}
    </div>
  );
}

function bindCanvasDraw(canvas, drawingRef) {
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a2332';
  ctx.lineWidth = 2.2;

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: ((src.clientX - rect.left) * canvas.width) / rect.width,
      y: ((src.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const start = (e) => {
    drawingRef.current = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  };
  const end = () => {
    drawingRef.current = false;
  };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  return () => {
    canvas.removeEventListener('mousedown', start);
    canvas.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', end);
    canvas.removeEventListener('touchstart', start);
    canvas.removeEventListener('touchmove', move);
    canvas.removeEventListener('touchend', end);
  };
}

function SignPanel({
  isNonSigning,
  receiverDone,
  busy,
  error,
  mode,
  setMode,
  typedName,
  setTypedName,
  canvasRef,
  clearCanvas,
  submit,
  unlocked,
  confirmedRead,
  setConfirmedRead,
}) {
  if (receiverDone) return null;

  return (
    <section className="rs-sign-section" id="rs-sign-section" aria-label="Sign document">
      <div className="rs-panel-card">
        {!unlocked ? (
          <>
            <div className="rs-panel-step">Almost there</div>
            <h2 className="rs-panel-title">Finish reading the document</h2>
            <p className="rs-panel-lede">
              Scroll through the full document above. The signing options appear here only after you
              reach the end.
            </p>
            <p className="rs-gate-hint" role="status">
              Keep scrolling to unlock signing…
            </p>
          </>
        ) : (
          <>
            <div className="rs-panel-step">Step 2 of 2. Action required</div>
            <h2 className="rs-panel-title">
              {isNonSigning ? 'Acknowledge this document' : 'Sign this document'}
            </h2>
            <p className="rs-panel-lede">
              {isNonSigning
                ? 'Confirm you have read and understood the document sent by Tylo Care.'
                : 'Add your signature only after reviewing the full document from Tylo Care.'}
            </p>

            <label className="rs-confirm-read">
              <input
                type="checkbox"
                checked={confirmedRead}
                onChange={(e) => setConfirmedRead(e.target.checked)}
              />
              <span>I have read the entire document above</span>
            </label>

            {error && <p className="rs-panel-error">{error}</p>}

            {!confirmedRead ? (
              <p className="rs-gate-hint">Confirm you finished reading to continue.</p>
            ) : isNonSigning ? (
              <button className="rs-btn-primary" type="button" disabled={busy} onClick={submit}>
                {busy ? 'Processing…' : 'I acknowledge'}
              </button>
            ) : (
              <>
                <div className="rs-mode-tabs" role="tablist" aria-label="Signature method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'TYPED'}
                    className={`rs-mode-tab ${mode === 'TYPED' ? 'is-active' : ''}`}
                    onClick={() => setMode('TYPED')}
                  >
                    Type
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'DRAWN'}
                    className={`rs-mode-tab ${mode === 'DRAWN' ? 'is-active' : ''}`}
                    onClick={() => setMode('DRAWN')}
                  >
                    Draw
                  </button>
                </div>

                {mode === 'TYPED' ? (
                  <div className="rs-field">
                    <label htmlFor="rs-typed-name">Full legal name</label>
                    <input
                      id="rs-typed-name"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      autoComplete="name"
                      placeholder="Your name as it should appear"
                    />
                    {typedName.trim() && (
                      <div className="rs-signature-preview" aria-hidden="true">
                        {typedName.trim()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rs-draw-box">
                    <div className="rs-draw-head">
                      <span>Draw your signature</span>
                      <button type="button" className="rs-link-btn" onClick={clearCanvas}>
                        Clear
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      className="rs-canvas"
                      width={720}
                      height={220}
                      aria-label="Signature pad"
                    />
                  </div>
                )}

                <button
                  className="rs-btn-primary"
                  type="button"
                  disabled={busy || (mode === 'TYPED' && !typedName.trim())}
                  onClick={submit}
                >
                  {busy ? 'Submitting…' : 'Finish signing'}
                </button>
              </>
            )}

            <p className="rs-panel-footnote">
              By continuing, you agree this electronic record is legally binding.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default function RecipientSignPage() {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('TYPED');
  const [typedName, setTypedName] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [reachedEnd, setReachedEnd] = useState(false);
  const [openedExternally, setOpenedExternally] = useState(false);
  const [confirmedRead, setConfirmedRead] = useState(false);
  const [mobile, setMobile] = useState(() => isLikelyMobile());
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const pdfUrlRef = useRef('');
  const endSentinelRef = useRef(null);

  const unlocked = reachedEnd || openedExternally;

  const loadPdf = async () => {
    if (!token) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      const res = await apiFetch(`/recipient/${token}/pdf`);
      if (!res.ok) throw new Error('Could not load document preview');
      const blob = await res.blob();
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    } catch (e) {
      setPdfError(e.message || 'PDF preview failed');
      setPdfUrl('');
    } finally {
      setPdfLoading(false);
    }
  };

  const load = () =>
    fetch(apiUrl(`/recipient/${token}`))
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error?.message || j.message || 'Unable to open document');
        setDoc(j.data);
        setTypedName(j.data?.receiver?.name || '');
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!doc) return undefined;
    loadPdf();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doc?.status, doc?.receiver?.status, doc?.sender?.status]);

  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    []
  );

  useEffect(() => {
    const onResize = () => setMobile(isLikelyMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (mode !== 'DRAWN' || !canvasRef.current || !unlocked || !confirmedRead) return undefined;
    return bindCanvasDraw(canvasRef.current, drawing);
  }, [mode, doc, unlocked, confirmedRead]);

  useEffect(() => {
    const el = endSentinelRef.current;
    if (!el || !doc) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReachedEnd(true);
        }
      },
      { root: null, threshold: 0.4, rootMargin: '0px 0px -8% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [doc, pdfUrl, pdfLoading]);

  const isNonSigning = doc?.signingType === 'NON_SIGNING';
  const receiverDone =
    doc?.receiver?.status === 'SIGNED' || doc?.receiver?.status === 'ACKNOWLEDGED';
  const receiverName = doc?.receiver?.name || 'there';
  const term =
    doc?.startDate || doc?.endDate
      ? [formatDate(doc.startDate), formatDate(doc.endDate)].filter(Boolean).join(' – ')
      : null;

  useEffect(() => {
    if (!unlocked || receiverDone) return undefined;
    const section = document.getElementById('rs-sign-section');
    if (!section) return undefined;
    const t = window.setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => window.clearTimeout(t);
  }, [unlocked, receiverDone]);

  const openDocument = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    setOpenedExternally(true);
  };

  const downloadDocument = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${doc?.agreementNumber || 'document'}.pdf`;
    a.click();
    setOpenedExternally(true);
  };

  const submit = async () => {
    if (!unlocked || !confirmedRead) {
      setError('Please finish reading the document and confirm before continuing.');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const url = isNonSigning
        ? apiUrl(`/recipient/${token}/acknowledge`)
        : apiUrl(`/recipient/${token}/sign`);
      const body = isNonSigning
        ? {}
        : mode === 'TYPED'
          ? { signatureType: 'TYPED', typedName: typedName.trim() }
          : { signatureType: 'DRAWN', signatureData: canvasRef.current?.toDataURL('image/png') };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || j.message || 'Failed');
      setDoc(j.data);
      setMsg(
        isNonSigning
          ? 'Your acknowledgment has been recorded. Thank you.'
          : 'Your signature has been recorded. Thank you.'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => loadPdf(), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  if (error && !doc) {
    return (
      <PageChrome>
        <main className="rs-main rs-main--center">
          <div className="rs-state-card">
            <h1>Document unavailable</h1>
            <p className="rs-state-error">{error}</p>
            <p className="rs-state-help">
              This link may have expired or already been completed. Please contact {SENDER_ORG} for
              assistance.
            </p>
          </div>
        </main>
      </PageChrome>
    );
  }

  if (!doc) {
    return (
      <PageChrome>
        <main className="rs-main rs-main--center">
          <p className="rs-loading">Loading your document…</p>
        </main>
      </PageChrome>
    );
  }

  return (
    <PageChrome>
      <main className="rs-main rs-main--flow">
        {(msg || receiverDone) && (
          <div className="rs-alert rs-alert--success" role="status">
            {msg ||
              (isNonSigning
                ? 'You have acknowledged this document.'
                : 'You have signed this document.')}
          </div>
        )}

        <div className="rs-flow">
          <section className="rs-envelope">
            <p className="rs-step-label">Step 1 of 2. Review document</p>
            <p className="rs-sent-by">
              Sent by <strong>{SENDER_ORG}</strong>
            </p>
            <h1 className="rs-doc-title">{doc.title}</h1>
            <p className="rs-greeting">
              <strong>{receiverName}</strong>, please read the full document below. Signing
              options appear only after you reach the end
              {isNonSigning ? ' and acknowledge.' : '.'}
            </p>
            <ul className="rs-facts">
              <li>
                <span>Reference</span>
                <strong>{doc.agreementNumber}</strong>
              </li>
              <li>
                <span>Recipient</span>
                <strong>{receiverName}</strong>
              </li>
              {term && (
                <li>
                  <span>Term</span>
                  <strong>{term}</strong>
                </li>
              )}
              <li>
                <span>Document type</span>
                <strong>
                  {doc.type === 'TEMPORARY_OWNERSHIP' ? 'Temporary ownership' : 'Lease agreement'}
                </strong>
              </li>
            </ul>
          </section>

          {doc.envelopeMessage && (
            <section className="rs-note">
              <h2>Message from {SENDER_ORG}</h2>
              <p>{doc.envelopeMessage}</p>
            </section>
          )}

          <article className="rs-paper rs-paper--pdf">
            <header className="rs-paper-head">
              <div>
                <div className="rs-paper-org">{SENDER_ORG}</div>
                <div className="rs-paper-sent">Document</div>
              </div>
              <div className="rs-paper-ref">
                <span>{doc.agreementNumber}</span>
              </div>
            </header>

            <div className="rs-doc-toolbar">
              <button
                type="button"
                className="rs-btn-secondary"
                onClick={openDocument}
                disabled={!pdfUrl || pdfLoading}
              >
                {mobile ? 'Open full document' : 'Open in new tab'}
              </button>
              <button
                type="button"
                className="rs-btn-secondary"
                onClick={downloadDocument}
                disabled={!pdfUrl || pdfLoading}
              >
                Download PDF
              </button>
            </div>

            {mobile && (
              <p className="rs-mobile-read-tip">
                On phones, tap <strong>Open full document</strong> to read every page clearly, then
                return here to sign at the bottom.
              </p>
            )}

            {pdfLoading && <p className="rs-doc-status">Loading document…</p>}
            {pdfError && <p className="rs-panel-error">{pdfError}</p>}

            {!pdfLoading && pdfUrl && !mobile && (
              <div className="rs-pdf-frame-wrap">
                <iframe
                  title="Document preview"
                  className="rs-pdf-frame pdf-preview-frame"
                  src={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                />
              </div>
            )}

            {!pdfLoading && pdfUrl && mobile && (
              <div className="rs-mobile-doc-card">
                <p>
                  Tap below to open the full PDF in your phone viewer, then come back to this page
                  to sign at the bottom.
                </p>
                <button
                  type="button"
                  className="rs-btn-primary"
                  onClick={openDocument}
                >
                  View full document
                </button>
                {openedExternally && (
                  <p className="rs-gate-hint" style={{ marginTop: 12 }}>
                    After reading, scroll down to complete signing.
                  </p>
                )}
              </div>
            )}

            <div className="rs-doc-end" ref={endSentinelRef} aria-hidden="true">
              <span>End of document</span>
            </div>
          </article>

          {!receiverDone && (
            <SignPanel
              isNonSigning={isNonSigning}
              receiverDone={receiverDone}
              busy={busy}
              error={error}
              mode={mode}
              setMode={setMode}
              typedName={typedName}
              setTypedName={setTypedName}
              canvasRef={canvasRef}
              clearCanvas={clearCanvas}
              submit={submit}
              unlocked={unlocked}
              confirmedRead={confirmedRead}
              setConfirmedRead={setConfirmedRead}
            />
          )}
        </div>
      </main>
    </PageChrome>
  );
}

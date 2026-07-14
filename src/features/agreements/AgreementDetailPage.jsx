import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { api, apiFetch } from '../../shared/api.js';
import { MODULE, FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';

const STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SENT: { label: 'Out for action', tone: 'info' },
  PARTIALLY_SIGNED: { label: 'Partially complete', tone: 'warn' },
  COMPLETED: { label: 'Completed', tone: 'ok' },
  ACTIVE: { label: 'Active', tone: 'ok' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  TERMINATED: { label: 'Terminated', tone: 'neutral' },
};

function SignatureMark({ signer, label, showDate }) {
  const data = signer?.signatureData || '';
  const isImage =
    signer?.signatureType === 'DRAWN' ||
    signer?.signatureType === 'UPLOADED' ||
    (typeof data === 'string' && data.startsWith('data:image'));
  const done = signer && (signer.status === 'SIGNED' || signer.status === 'ACKNOWLEDGED');
  const when = signer?.acknowledgedAt || signer?.signedAt;

  return (
    <div className="esign-party-sig">
      {label && <div className="esign-party-sig-label">{label}</div>}
      {done ? (
        <>
          <div className="esign-sig-pad esign-sig-pad-sm">
            {isImage ? (
              <img src={data} alt={`Signature of ${signer.name}`} />
            ) : (
              <div className="esign-typed-sig esign-typed-sig-sm">{data || signer.name}</div>
            )}
          </div>
          {showDate && (
            <div className="esign-sig-date">
              Date: {when ? new Date(when).toLocaleDateString() : '—'}
            </div>
          )}
          <div className="esign-sig-meta">
            <strong>{signer.name}</strong>
          </div>
        </>
      ) : (
        <>
          <div className="esign-party-sig-await">
            {signer?.name ? `${signer.name} — awaiting` : 'Awaiting'}
          </div>
          {showDate && <div className="esign-sig-date">Date: —</div>}
        </>
      )}
    </div>
  );
}

function partyOf(signers, side) {
  return (
    (signers || []).find((s) => s.partySide === side || s.role === side) ||
    (side === 'RECEIVER'
      ? (signers || []).find((s) => s.role === 'SIGNER' || s.role === 'RECIPIENT')
      : null)
  );
}

function bindCanvasDraw(canvas, drawingRef) {
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0b1a24';
  ctx.lineWidth = 2.5;

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
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

export default function AgreementDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [doc, setDoc] = useState(null);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('document');
  const [assetId, setAssetId] = useState('');
  const [signTarget, setSignTarget] = useState('');
  const [signMode, setSignMode] = useState('TYPED');
  const [typedName, setTypedName] = useState('');
  const [signDockOpen, setSignDockOpen] = useState(false);
  const [masterSignatures, setMasterSignatures] = useState([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const canvasRef = useRef(null);
  const dockCanvasRef = useRef(null);
  const drawing = useRef(false);
  const signaturesRef = useRef(null);
  const pdfUrlRef = useRef('');

  const load = useCallback(async () => {
    const r = await api(`/agreements/${id}`);
    setDoc(r.data);
    return r.data;
  }, [id]);

  const loadMasterSignatures = useCallback(() => {
    api('/signatures?limit=100')
      .then((r) => setMasterSignatures(r.data || []))
      .catch(() => setMasterSignatures([]));
  }, []);

  const loadPdfPreview = useCallback(async () => {
    if (!id) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      const res = await apiFetch(`/agreements/${id}/pdf`);
      if (!res.ok) throw new Error('Could not load PDF preview');
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
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api('/assets?limit=200').then((r) => setAssets(r.data)).catch(() => {});
    loadMasterSignatures();
  }, [load, loadMasterSignatures]);

  const signFingerprint = (doc?.signers || [])
    .map((s) => `${s.id}:${s.status}:${s.signedAt || ''}:${s.acknowledgedAt || ''}`)
    .join('|');

  useEffect(() => {
    if (!doc?._id) return undefined;
    loadPdfPreview();
    return undefined;
  }, [loadPdfPreview, doc?._id, doc?.status, signFingerprint]);

  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    []
  );

  useEffect(() => {
    const canvas =
      (signDockOpen && dockCanvasRef.current) ||
      (tab === 'sign' ? canvasRef.current : null);
    if (!canvas || signMode !== 'DRAWN') return undefined;
    return bindCanvasDraw(canvas, drawing);
  }, [signMode, tab, signDockOpen]);

  if (!doc) return <p className="muted" style={{ padding: 14 }}>{error || 'Loading document…'}</p>;

  const meta = STATUS_META[doc.status] || { label: doc.status, tone: 'neutral' };
  const canWrite = can('agreements:write');
  const isNonSigning = doc.signingType === 'NON_SIGNING';
  const sender = partyOf(doc.signers, 'SENDER');
  const receiver = partyOf(doc.signers, 'RECEIVER');
  const senderSigned = sender?.status === 'SIGNED';
  const needsSenderSign = canWrite && !isNonSigning && doc.status === 'DRAFT' && !senderSigned;
  const recipientLink = doc.recipientShortCode
    ? `${window.location.origin}/s/${doc.recipientShortCode}`
    : doc.recipientAccessToken
      ? `${window.location.origin}/sign/${doc.recipientAccessToken}`
      : '';
  const sentAwaitingReceiver = ['SENT', 'PARTIALLY_SIGNED'].includes(doc.status);

  const clearCanvas = (ref = canvasRef) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const openSenderSign = () => {
    if (sender) {
      setSignTarget(sender.id);
      setTypedName(sender.name || '');
    }
    if (doc.defaultSenderSignatureId) {
      setSignMode('MASTER');
      setSelectedMasterId(doc.defaultSenderSignatureId);
      loadMasterSignatures();
    }
    setSignDockOpen(true);
    setTab('document');
  };

  const closeSignDock = () => setSignDockOpen(false);

  const applySignature = async (targetId, canvas) => {
    setError('');
    if (signMode === 'MASTER') {
      if (!selectedMasterId) {
        setError('Pick a signature from Signature Master');
        return;
      }
      const ok = await run(async () => {
        await api(`/agreements/${id}/sign`, {
          method: 'POST',
          body: { signerId: targetId, signatureMasterId: selectedMasterId },
        });
      });
      if (ok) {
        setSignDockOpen(false);
        setSelectedMasterId('');
        setTimeout(() => {
          signaturesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
      return;
    }
    const nameForTyped = (typedName || sender?.name || '').trim();
    if (signMode === 'TYPED' && !nameForTyped) {
      setError('Enter your full legal name');
      return;
    }
    const ok = await run(async () => {
      const payload = {
        signerId: targetId,
        signatureType: signMode,
      };
      if (signMode === 'TYPED') payload.typedName = nameForTyped;
      else payload.signatureData = canvas?.toDataURL('image/png');
      await api(`/agreements/${id}/sign`, { method: 'POST', body: payload });
    });
    if (ok) {
      setSignDockOpen(false);
      setTimeout(() => {
        signaturesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  };

  const copyRecipientLink = async () => {
    if (!recipientLink) return;
    try {
      await navigator.clipboard.writeText(recipientLink);
      setError('');
      alert('Receiver signing link copied');
    } catch {
      setError('Could not copy link');
    }
  };

  const downloadPdf = async () => {
    setError('');
    try {
      const res = await apiFetch(`/agreements/${id}/pdf?download=1`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const signed =
        ['COMPLETED', 'ACTIVE'].includes(doc.status) ||
        (sender?.status === 'SIGNED' &&
          (receiver?.status === 'SIGNED' || receiver?.status === 'ACKNOWLEDGED'));
      a.download = `${doc.title || doc.agreementNumber || 'agreement'}${signed ? '-signed' : ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Download failed');
    }
  };

  const isFullySigned =
    ['COMPLETED', 'ACTIVE'].includes(doc.status) ||
    (isNonSigning
      ? receiver?.status === 'ACKNOWLEDGED' || receiver?.status === 'SIGNED'
      : senderSigned &&
        (receiver?.status === 'SIGNED' || receiver?.status === 'ACKNOWLEDGED'));

  return (
    <div className="esign-shell">
      <div className="esign-top">
        <div>
          <p className="eyebrow">
            <Link to="/agreements">{MODULE.ASSET_AGREEMENT}</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span>{doc.agreementNumber}</span>
          </p>
          <h1>{doc.title}</h1>
          <div className="row" style={{ marginTop: 6 }}>
            <span className={`badge tone-${meta.tone}`}>{meta.label}</span>
            <span className={`badge ${isNonSigning ? 'tone-info' : 'tone-ok'}`}>
              {isNonSigning ? 'Non-signing' : 'Signing'}
            </span>
            <span className="muted mono-sm">
              {doc.type === 'TEMPORARY_OWNERSHIP' ? 'Temporary ownership' : 'Lease'}
            </span>
            <span className="muted">· {doc.partyName}</span>
          </div>
        </div>
        <div className="row">
          {canWrite && doc.status === 'DRAFT' && (
            <button
              className="btn"
              type="button"
              disabled={!isNonSigning && !senderSigned}
              title={
                !isNonSigning && !senderSigned
                  ? 'Sign as owner first, then send to the receiver'
                  : undefined
              }
              onClick={() => run(() => api(`/agreements/${id}/send`, { method: 'POST', body: {} }))}
            >
              {isNonSigning ? 'Send for acknowledgment' : 'Send to receiver'}
            </button>
          )}
          {canWrite && sentAwaitingReceiver && recipientLink && (
            <button className="btn secondary" type="button" onClick={copyRecipientLink}>
              Copy receiver signing link
            </button>
          )}
          {canWrite && doc.status === 'COMPLETED' && (
            <button
              className="btn"
              type="button"
              onClick={() => run(() => api(`/agreements/${id}/activate`, { method: 'POST', body: {} }))}
            >
              Activate agreement
            </button>
          )}
          {canWrite && doc.status === 'ACTIVE' && (
            <button
              className="btn danger"
              type="button"
              onClick={() => run(() => api(`/agreements/${id}/terminate`, { method: 'POST', body: {} }))}
            >
              Terminate
            </button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="esign-tabs">
        {['document', 'signers', 'sign', 'assets', 'activity'].map((t) => (
          <button
            key={t}
            type="button"
            className={`esign-tab ${tab === t ? 'is-active' : ''}`}
            onClick={() => {
              setTab(t);
              if (t !== 'document') setSignDockOpen(false);
            }}
          >
            {t === 'sign'
              ? 'Owner sign'
              : t === 'signers'
                ? 'Parties'
                : t === 'assets'
                  ? MODULE.ASSET_INVENTORY
                  : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'document' && (
        <div className="esign-doc-view">
          <div className="esign-parties-strip" ref={signaturesRef} id="executed-signatures">
            <div className="esign-party-card">
              <SignatureMark signer={sender} label="Sender / Owner" />
            </div>
            <div className="esign-party-card">
              <SignatureMark signer={receiver} label="Receiver" showDate />
            </div>
          </div>

          <section className="card esign-pdf-panel">
            <div className="esign-pdf-toolbar">
              <div>
                <strong>{isFullySigned ? 'Signed document' : 'Document preview'}</strong>
                <p className="muted" style={{ margin: '2px 0 0' }}>
                  {isFullySigned
                    ? 'Executed PDF with both party marks on every page.'
                    : 'Live preview — signatures appear here as each party completes.'}
                </p>
              </div>
              <button className="btn secondary" type="button" onClick={downloadPdf} disabled={pdfLoading}>
                Download PDF
              </button>
            </div>
            {pdfLoading && <p className="muted">Loading preview…</p>}
            {pdfError && <p className="error">{pdfError}</p>}
            {!pdfLoading && pdfUrl && (
              <iframe title="Agreement PDF" className="pdf-preview-frame esign-pdf-frame" src={pdfUrl} />
            )}
            {!pdfLoading && !pdfUrl && !pdfError && (
              <p className="muted">No preview available.</p>
            )}
          </section>

          {needsSenderSign &&
            createPortal(
              !signDockOpen ? (
                <div className="esign-doc-fab">
                  <button
                    type="button"
                    className="btn esign-fab-btn"
                    onClick={openSenderSign}
                    title="Apply your owner signature before sending"
                  >
                    Sign as owner
                  </button>
                </div>
              ) : (
                <div className="esign-sign-dock" role="dialog" aria-label="Sign as owner">
                  <div className="esign-sign-dock-head">
                    <div>
                      <strong>Sign as owner (sender)</strong>
                      <div className="muted mono-sm">
                        Your signature appears on the left. The receiver signs separately via their link.
                      </div>
                    </div>
                    <button type="button" className="btn secondary btn-compact" onClick={closeSignDock}>
                      Close
                    </button>
                  </div>
                  <div className="esign-sign-modes">
                    <button
                      type="button"
                      className={`btn secondary ${signMode === 'MASTER' ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSignMode('MASTER');
                        loadMasterSignatures();
                      }}
                    >
                      From master
                    </button>
                    <button
                      type="button"
                      className={`btn secondary ${signMode === 'TYPED' ? 'is-selected' : ''}`}
                      onClick={() => setSignMode('TYPED')}
                    >
                      Type
                    </button>
                    <button
                      type="button"
                      className={`btn secondary ${signMode === 'DRAWN' ? 'is-selected' : ''}`}
                      onClick={() => setSignMode('DRAWN')}
                    >
                      Draw
                    </button>
                  </div>
                  {signMode === 'MASTER' ? (
                    <div>
                      <p className="muted" style={{ marginTop: 0 }}>
                        Use your stored signature
                        {can('*') ? ' (admins can pick any master mark)' : ' from your profile'}.{' '}
                        <Link to="/agreements/signature-master">Manage</Link>
                      </p>
                      <div className="sig-pick-list">
                        {masterSignatures.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            className={`sig-pick-item ${selectedMasterId === s._id ? 'is-selected' : ''}`}
                            onClick={() => setSelectedMasterId(s._id)}
                          >
                            <strong>
                              {s.roleLabel} — {s.name}
                            </strong>
                            <div className="sig-pick-preview">
                              {(s.signatureType === 'DRAWN' || s.signatureType === 'UPLOADED') &&
                              s.signatureData?.startsWith('data:image') ? (
                                <img src={s.signatureData} alt="" />
                              ) : (
                                <div className="esign-typed-sig">{s.signatureData || s.name}</div>
                              )}
                            </div>
                          </button>
                        ))}
                        {!masterSignatures.length && (
                          <p className="muted">No signature saved yet — add one in Signature Master.</p>
                        )}
                      </div>
                    </div>
                  ) : signMode === 'TYPED' ? (
                    <div className="field">
                      <label>Full legal name</label>
                      <input
                        className="esign-typed-input"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div>
                      <canvas
                        ref={dockCanvasRef}
                        className="esign-canvas esign-canvas-dock"
                        width={480}
                        height={160}
                      />
                      <button
                        className="btn secondary btn-compact"
                        type="button"
                        onClick={() => clearCanvas(dockCanvasRef)}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  <button
                    className="btn esign-fab-btn"
                    type="button"
                    disabled={
                      !sender ||
                      (signMode === 'TYPED' && !typedName.trim()) ||
                      (signMode === 'MASTER' && !selectedMasterId)
                    }
                    onClick={() => applySignature(sender.id, dockCanvasRef.current)}
                  >
                    Apply owner signature
                  </button>
                </div>
              ),
              document.body
            )}
        </div>
      )}

      {tab === 'signers' && (
        <section className="card esign-parties-panel">
          <h3>Parties</h3>
          <div className="esign-parties-strip esign-parties-strip-lg">
            <div className="esign-party-card">
              <SignatureMark signer={sender} label="Sender / Owner" />
              <div className="muted mono-sm" style={{ marginTop: 8 }}>
                {sender?.email || '—'}
              </div>
              <span className="badge" style={{ marginTop: 8 }}>
                {sender?.status || 'PENDING'}
              </span>
            </div>
            <div className="esign-party-card">
              <SignatureMark signer={receiver} label="Receiver" showDate />
              <div className="muted mono-sm" style={{ marginTop: 8 }}>
                {receiver?.email || doc.partyEmail || '—'}
              </div>
              <span className="badge" style={{ marginTop: 8 }}>
                {receiver?.status || 'PENDING'}
              </span>
            </div>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Sender signs as owner before send. Receiver signs only via their secure link.
          </p>
        </section>
      )}

      {tab === 'sign' && (
        <section className="card esign-sign-panel">
          <h3>Owner signature</h3>
          {isNonSigning ? (
            <p className="muted">
              This template does not require signatures. Send the document and share the receiver
              acknowledgment link.
            </p>
          ) : senderSigned ? (
            <p className="muted">
              Owner signature is applied. Send to the receiver, then copy their signing link.
            </p>
          ) : (
            <>
              <p className="muted">
                Sign as the document owner before sending. Your mark appears on the left of every page
                footer. You cannot sign for the customer.
              </p>
              <button className="btn" type="button" onClick={openSenderSign}>
                Sign as owner
              </button>
            </>
          )}
          {sentAwaitingReceiver && recipientLink && (
            <div style={{ marginTop: 16 }}>
              <p className="muted">Share this link with {receiver?.name || doc.partyName}:</p>
              <code className="mono-sm">{recipientLink}</code>
              <div style={{ marginTop: 8 }}>
                <button className="btn secondary" type="button" onClick={copyRecipientLink}>
                  Copy link
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'assets' && (
        <div className="esign-assets-grid">
          <section className="card">
            <h3>Linked assets</h3>
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>{FIELD.ASSET_NAME}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(doc.assets || []).map((l) => (
                  <tr key={l._id}>
                    <td>{l.assetId?.assetTag || '—'}</td>
                    <td>{l.assetId?.deviceNameSnapshot || '—'}</td>
                    <td>{l.assetId?.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!doc.assets?.length && <p className="muted">No assets linked.</p>}
          </section>
          {canWrite && (
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api(`/agreements/${id}/assets`, {
                    method: 'POST',
                    body: { assetIds: [assetId] },
                  });
                  setAssetId('');
                });
              }}
            >
              <h3>Link {MODULE.ASSET_INVENTORY} item</h3>
              <div className="field">
                <label>Asset</label>
                <select required value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">Select</option>
                  {assets.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.assetTag} — {a.deviceNameSnapshot}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn" type="submit">
                Link
              </button>
            </form>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <section className="card">
          <h3>Activity &amp; audit trail</h3>
          <ol className="esign-activity">
            {(doc.activity || []).map((ev) => (
              <li key={ev._id}>
                <div className="esign-activity-action">{ev.action}</div>
                <div>{ev.message}</div>
                <div className="muted mono-sm">
                  {ev.actorName || ev.actorEmail || 'System'} ·{' '}
                  {ev.at ? new Date(ev.at).toLocaleString() : ''}
                </div>
              </li>
            ))}
          </ol>
          {!doc.activity?.length && <p className="muted">No activity yet.</p>}
        </section>
      )}
    </div>
  );
}

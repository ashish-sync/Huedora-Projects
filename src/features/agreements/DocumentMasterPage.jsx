import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import DocxNativePreview from '../../components/DocxNativePreview.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';

const DOCUMENT_TYPES = [
  { value: 'LEASE', label: 'Lease' },
  { value: 'TEMPORARY_OWNERSHIP', label: 'Temporary ownership' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'OTHER', label: 'Other' },
];

/** Soft A4 body capacity; leaves room for header and signature footer on every page. */
const PAGE_MAX_LINES = 24;
const PAGE_LINE_WIDTH = 72;

function typeLabel(t) {
  return DOCUMENT_TYPES.find((d) => d.value === t)?.label || t || '-';
}

function signingLabel(s) {
  return s === 'NON_SIGNING' ? 'Non-signing' : 'Signing';
}

/** Wrap a long word that exceeds the line width. */
function chunkWord(word, width) {
  if (word.length <= width) return [word];
  const parts = [];
  for (let i = 0; i < word.length; i += width) parts.push(word.slice(i, i + width));
  return parts;
}

/**
 * Break text into page bodies that always leave space for the signature footer.
 * Long paragraphs are soft-wrapped and can split across pages.
 */
function paginateDocument(text, maxLines = PAGE_MAX_LINES, lineWidth = PAGE_LINE_WIDTH) {
  const clean = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .trim();
  if (!clean) return ['(Empty document body)'];

  const lines = [];
  for (const paragraph of clean.split('\n')) {
    const trimmed = paragraph.trimEnd();
    if (!trimmed.trim()) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      for (const piece of chunkWord(word, lineWidth)) {
        const next = current ? `${current} ${piece}` : piece;
        if (next.length <= lineWidth) {
          current = next;
        } else {
          if (current) lines.push(current);
          current = piece;
        }
      }
    }
    if (current) lines.push(current);
  }

  if (!lines.length) return ['(Empty document body)'];

  const pages = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const slice = lines.slice(i, i + maxLines);
    // Drop trailing blank lines on a page (keeps footer visually tight)
    while (slice.length > 1 && !String(slice[slice.length - 1]).trim()) slice.pop();
    pages.push(slice.join('\n'));
  }

  return pages.length ? pages : ['(Empty document body)'];
}

function SignatureFooterPreview({ signingType, defaultSenderSignature }) {
  const nonSigning = signingType === 'NON_SIGNING';
  const sampleDate = new Date().toLocaleDateString();
  const sender = defaultSenderSignature;
  const senderIsImage =
    sender &&
    (sender.signatureType === 'DRAWN' ||
      sender.signatureType === 'UPLOADED' ||
      (typeof sender.signatureData === 'string' && sender.signatureData.startsWith('data:image')));

  return (
    <div className="esign-page-footer dm-sheet-footer">
      <div className="esign-party-sig">
        <div className="esign-party-sig-label">Sender / Owner</div>
        {sender ? (
          <div className="esign-sig-pad esign-sig-pad-sm">
            {senderIsImage ? (
              <img src={sender.signatureData} alt="" />
            ) : (
              <div className="esign-sig-sample">{sender.signatureData || sender.name}</div>
            )}
          </div>
        ) : (
          <div className="esign-sig-sample">Sender</div>
        )}
        <div className="muted mono-sm">{sender?.name || 'Default sender mark'}</div>
      </div>
      <div className="esign-party-sig">
        <div className="esign-party-sig-label">{nonSigning ? 'Receiver / Acknowledge' : 'Receiver'}</div>
        <div className="esign-sig-sample">{nonSigning ? 'Acknowledge' : 'Receiver'}</div>
        <div className="esign-sig-date">Date: {sampleDate}</div>
      </div>
    </div>
  );
}

function TemplatePreviewModal({ template, onClose }) {
  const useNativeDocx = Boolean(template?.storageKey || template?.sourceType === 'DOCX');
  const pages = useMemo(
    () => (useNativeDocx ? [] : paginateDocument(template?.bodyHtml || '')),
    [template?.bodyHtml, useNativeDocx]
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [overview, setOverview] = useState(false);

  const ZOOM_STEPS = [0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3];

  useEffect(() => {
    setPageIndex(0);
    setZoom(1);
    setOverview(false);
  }, [template?._id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (!useNativeDocx && !overview) {
        if (e.key === 'ArrowRight') setPageIndex((p) => Math.min(pages.length - 1, p + 1));
        if (e.key === 'ArrowLeft') setPageIndex((p) => Math.max(0, p - 1));
      }
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom((z) => {
          const i = ZOOM_STEPS.findIndex((s) => s >= z - 0.001);
          return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, (i < 0 ? 0 : i) + 1)] || z;
        });
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => {
          const i = ZOOM_STEPS.findIndex((s) => s >= z - 0.001);
          return ZOOM_STEPS[Math.max(0, (i < 0 ? 0 : i) - 1)] || z;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pages.length, overview, useNativeDocx]);

  if (!template) return null;

  const total = pages.length;
  const zoomPct = Math.round(zoom * 100);
  const zoomIn = () => {
    setOverview(false);
    setZoom((z) => {
      const i = ZOOM_STEPS.findIndex((s) => s > z + 0.001);
      return i === -1 ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : ZOOM_STEPS[i];
    });
  };
  const zoomOut = () => {
    setZoom((z) => {
      const rev = [...ZOOM_STEPS].reverse();
      const found = rev.find((s) => s < z - 0.001);
      return found ?? ZOOM_STEPS[0];
    });
  };
  const showAllPages = () => {
    setOverview(true);
    setZoom(Math.min(0.55, 0.85 / Math.max(1, Math.sqrt(Math.max(total, 3)))));
  };

  const showSigningFooter = template.signingType === 'SIGNING';

  const renderSheet = (text, index) => (
    <div
      key={index}
      className="dm-sheet-scale-wrap"
      style={{
        width: `min(100%, ${720 * zoom}px)`,
        height: `${920 * zoom}px`,
        marginBottom: overview ? 14 : 0,
      }}
    >
      <article
        className="dm-sheet dm-sheet-signed"
        aria-label={`Page ${index + 1}`}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="dm-sheet-main">
          <div className="dm-sheet-top">
            <span>{template.name}</span>
            <span>
              Page {index + 1} / {total}
            </span>
          </div>
          <p className="dm-sheet-banner muted">
            {showSigningFooter
              ? 'Preview as sent · Signature footer on every page'
              : 'Preview as sent · Non-signing document'}
          </p>
          <div className="dm-sheet-rule" />
          <pre className="dm-sheet-body">{text}</pre>
        </div>
        {showSigningFooter && (
          <SignatureFooterPreview
            signingType={template.signingType}
            defaultSenderSignature={template.defaultSenderSignature}
          />
        )}
      </article>
    </div>
  );

  return createPortal(
    <div className="dm-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${template.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dm-modal-head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              {useNativeDocx ? 'Word document preview' : 'Customer-facing preview'}
            </p>
            <h2>{template.name}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {typeLabel(template.documentType || template.agreementType)} ·{' '}
              {signingLabel(template.signingType)}
              {useNativeDocx
                ? ` · As in Word · ${zoomPct}%`
                : !overview
                  ? ` · Page ${pageIndex + 1} of ${total} · ${zoomPct}%`
                  : ` · All ${total} page${total === 1 ? '' : 's'} · ${zoomPct}%`}
            </p>
          </div>
          <div className="dm-modal-actions">
            <div className="dm-zoom-group" role="group" aria-label="Zoom">
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={zoomOut}
                title="Zoom out (−)"
                disabled={zoom <= ZOOM_STEPS[0]}
              >
                −
              </button>
              <span className="dm-zoom-label">{zoomPct}%</span>
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={zoomIn}
                title="Zoom in (+)"
                disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              >
                +
              </button>
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={() => {
                  setOverview(false);
                  setZoom(1);
                }}
                title="Reset to 100%"
              >
                100%
              </button>
              {!useNativeDocx && (
                <button
                  type="button"
                  className={`btn secondary btn-compact ${overview ? 'is-selected' : ''}`}
                  onClick={showAllPages}
                  title="Zoom out to see the full document"
                >
                  Fit all
                </button>
              )}
            </div>
            {!useNativeDocx && !overview && (
              <>
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  disabled={pageIndex <= 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  disabled={pageIndex >= total - 1}
                  onClick={() => setPageIndex((p) => Math.min(total - 1, p + 1))}
                >
                  Next →
                </button>
              </>
            )}
            <button type="button" className="btn secondary btn-compact" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div
          className={`dm-modal-stage ${overview ? 'is-overview' : ''}`}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            if (e.deltaY < 0) zoomIn();
            else zoomOut();
          }}
        >
          {useNativeDocx ? (
            <div
              className="dm-zoom-canvas dm-native-zoom"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              <DocxNativePreview templateId={template._id} />
            </div>
          ) : (
            <div className="dm-zoom-canvas">
              {overview
                ? pages.map((text, i) => renderSheet(text, i))
                : renderSheet(pages[pageIndex] || '', pageIndex)}
            </div>
          )}

          {!useNativeDocx && !overview && total > 1 && (
            <div className="dm-page-dots" aria-hidden="true">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`dm-page-dot ${i === pageIndex ? 'is-active' : ''}`}
                  onClick={() => setPageIndex(i)}
                  title={`Page ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {(template.placeholders || []).length > 0 && (
          <footer className="dm-modal-fields">
            <strong>Merge fields</strong>
            <div className="dm-upload-fields">
              {(template.placeholders || []).map((p) => (
                <span key={`${p.key}-${p.occurrence || 0}`} className="badge">
                  {p.label}
                </span>
              ))}
            </div>
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function DocumentMasterPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const [view, setView] = useState('templates');
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('LEASE');
  const [signingType, setSigningType] = useState('SIGNING');
  const [defaultSignatureId, setDefaultSignatureId] = useState('');
  const [masterSignatures, setMasterSignatures] = useState([]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [uploadPreviewText, setUploadPreviewText] = useState('');
  const [uploadPlaceholders, setUploadPlaceholders] = useState([]);

  const load = () => {
    const params = new URLSearchParams({ limit: '100', all: 'true' });
    if (q) params.set('q', q);
    return api(`/templates?${params}`)
      .then((r) => {
        setRows(r.data);
      })
      .catch((e) => setError(e.message));
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/templates/export', 'Document_Master.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const loadSignatures = () =>
    api('/signatures?limit=100')
      .then((r) => setMasterSignatures(r.data || []))
      .catch(() => setMasterSignatures([]));

  useEffect(() => {
    load();
    loadSignatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows.find((t) => t._id === selectedId) || null;

  const openPreview = (id) => {
    setSelectedId(id);
    setPreviewOpen(true);
  };

  const resetUploadForm = () => {
    setFile(null);
    setName('');
    setDocumentType('LEASE');
    setSigningType('SIGNING');
    setDefaultSignatureId('');
    setUploadPreviewText('');
    setUploadPlaceholders([]);
  };

  const onPickFile = async (picked) => {
    setError('');
    setFile(picked);
    setUploadPreviewText('');
    setUploadPlaceholders([]);
    if (!picked) return;

    const ext = picked.name.split('.').pop()?.toLowerCase();
    if (ext !== 'docx') {
      setError('Please choose a Word (.docx) file only.');
      setFile(null);
      return;
    }

    if (!name.trim()) {
      setName(picked.name.replace(/\.[^.]+$/, ''));
    }

    setAnalyzeBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', picked);
      const { data } = await api('/templates/analyze', { method: 'POST', body: fd });
      setUploadPreviewText(data.plain || '');
      setUploadPlaceholders(data.placeholders || []);
    } catch (err) {
      setError(err.message || 'Could not read this Word file.');
      setFile(null);
      setUploadPreviewText('');
      setUploadPlaceholders([]);
    } finally {
      setAnalyzeBusy(false);
    }
  };

  const uploadWord = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Enter the template name.');
      return;
    }
    if (!file) {
      setError('Choose a Word (.docx) file to upload.');
      return;
    }
    if (!uploadPreviewText) {
      setError('Wait for the document preview to finish loading.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      fd.append('documentType', documentType);
      fd.append('signingType', signingType);
      if (defaultSignatureId) fd.append('defaultSenderSignatureId', defaultSignatureId);
      const { data } = await api('/templates/upload', { method: 'POST', body: fd });
      resetUploadForm();
      setSelectedId(data._id);
      setView('templates');
      setPreviewOpen(true);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? 'esign-shell esign-shell--embedded' : 'esign-shell'}>
      {!embedded ? (
      <div className="esign-top">
        <div>
          <p className="eyebrow">
            <Link to="/">{MODULE.HOME}</Link>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <Link to="/agreements">{MODULE.DOCUMENT_HUB}</Link>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <span>{MODULE.DOCUMENT_MASTER}</span>
          </p>
          <h1>{MODULE.DOCUMENT_MASTER}</h1>
          <p className="muted esign-sub">
            Click a template to preview pages as the recipient will see them.
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
          <Link className="btn secondary" to="/agreements/new">
            Send a document
          </Link>
        </div>
      </div>
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="esign-sign-modes" role="tablist" aria-label="Document Master views">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'templates'}
          className={`btn secondary ${view === 'templates' ? 'is-selected' : ''}`}
          onClick={() => {
            setError('');
            setView('templates');
          }}
        >
          Existing templates
        </button>
        {can('agreements:write') && (
          <button
            type="button"
            role="tab"
            aria-selected={view === 'upload'}
            className={`btn secondary ${view === 'upload' ? 'is-selected' : ''}`}
            onClick={() => {
              setError('');
              setView('upload');
            }}
          >
            Upload new template
          </button>
        )}
      </div>

      {view === 'templates' && (
        <div className="master-layout master-layout-list">
          <div className="card">
            <div className="esign-toolbar" style={{ marginBottom: '0.85rem' }}>
              <input
                className="esign-search"
                placeholder="Search templates…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                aria-label="Search templates"
              />
              <button className="btn secondary" type="button" onClick={load}>
                Search
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Document type</th>
                    <th>Signing</th>
                    <th>Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr
                      key={t._id}
                      className={selectedId === t._id && previewOpen ? 'row-selected' : ''}
                      onClick={() => openPreview(t._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <strong>{t.name}</strong>
                        {t.originalFileName && (
                          <div className="muted mono-sm">{t.originalFileName}</div>
                        )}
                      </td>
                      <td>{typeLabel(t.documentType || t.agreementType)}</td>
                      <td>{signingLabel(t.signingType)}</td>
                      <td>
                        {(t.placeholders || []).length ? (
                          <span className="badge tone-ok">{(t.placeholders || []).length}</span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="muted" style={{ padding: '1rem' }}>
                  No templates yet. Upload a Word file to get started.
                </p>
              )}
            </div>
          </div>

          <div className="master-side">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Preview</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Select a document to preview A4 pages with Sender (left) and Receiver (right) signature areas.
              </p>
            </div>
          </div>
        </div>
      )}

      {view === 'upload' && can('agreements:write') && (
        <div className="master-layout dm-upload-layout">
          <form className="card dm-upload-card" onSubmit={uploadWord}>
            <h3 style={{ marginTop: 0 }}>Upload Word template</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Word files only (.docx). Placeholders like <code>[name]</code>, <code>[number]</code>,{' '}
              and <code>[alphanumeric]</code> are collected into the send form.{' '}
              <a href="/samples/Lease_Placeholder_Sample.docx" download>
                Download sample
              </a>
            </p>

            <div className="field">
              <label htmlFor="dm-file">Word document (.docx) *</label>
              <FilePicker
                id="dm-file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                required
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              {file && analyzeBusy ? (
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  Reading preview…
                </span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="dm-doc-type">Document type *</label>
              <AdaptiveSelect
                id="dm-doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                required
              >
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>

            <div className="field">
              <label htmlFor="dm-signing">Signing *</label>
              <AdaptiveSelect
                id="dm-signing"
                value={signingType}
                onChange={(e) => setSigningType(e.target.value)}
                required
              >
                <option value="SIGNING">Signing</option>
                <option value="NON_SIGNING">Non-signing</option>
              </AdaptiveSelect>
            </div>

            <div className="field">
              <label htmlFor="dm-default-sig">Default sender signature</label>
              <AdaptiveSelect
                id="dm-default-sig"
                value={defaultSignatureId}
                onChange={(e) => setDefaultSignatureId(e.target.value)}
              >
                <option value="">None (choose when signing)</option>
                {masterSignatures.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.roleLabel}: {s.name}
                  </option>
                ))}
              </AdaptiveSelect>
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                Used as the owner/sender mark for this template (left side).{' '}
                <Link to="/agreements/signature-master">Manage signatures</Link>
              </span>
            </div>

            <div className="field">
              <label htmlFor="dm-name">Name of the template *</label>
              <input
                id="dm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Equipment lease – custodian"
              />
            </div>

            {uploadPlaceholders.length > 0 && (
              <div className="field">
                <label>Detected fields</label>
                <div className="dm-upload-fields">
                  {uploadPlaceholders.map((p) => (
                    <span key={`${p.key}-${p.occurrence || 0}`} className="badge tone-ok">
                      {p.label} ({p.type})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="wizard-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  resetUploadForm();
                  setView('templates');
                }}
              >
                Cancel
              </button>
              <button className="btn" type="submit" disabled={busy || analyzeBusy || !uploadPreviewText}>
                {busy ? 'Uploading…' : analyzeBusy ? 'Reading…' : 'Upload'}
              </button>
            </div>
          </form>

          <aside className="card dm-upload-preview-card">
            <h3 style={{ marginTop: 0 }}>Document preview</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Preview pages, formatting, tables, and images before you upload.
            </p>
            <div className="dm-upload-preview-scroll">
              <DocxNativePreview file={file} />
            </div>
          </aside>
        </div>
      )}

      {previewOpen && selected && (
        <TemplatePreviewModal template={selected} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}


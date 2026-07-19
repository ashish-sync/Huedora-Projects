import { useEffect, useMemo, useRef, useState } from 'react';
import { communicationsApi } from './campOpsApi.js';
import { EmailPickBuffer } from './components/EmailPickBuffer';
import { EmailExtractionPanel } from './components/EmailExtractionPanel';
import { CampCreatedBanner, extractCreatedCamps } from './components/CampCreatedBanner';
import { IS_DEMO_SERVER } from './constants/roles';

const PASTE_AUTO_SAVE_KEY = 'connectorsManualPasteAutoSave';
const PASTE_DRAFT_KEY = 'connectorsManualPasteDraft';
const PREVIEW_AUTO_SAVE_DELAY_MS = 800;

const CONFIRM_COPY = {
  reextract: {
    title: 'Re-extract pasted content',
    message: 'This will run extraction again and replace the current preview. Manual edits that were not saved will be lost. Continue?',
    confirmLabel: 'Re-extract',
    confirmClass: 'btn-primary',
  },
  process: {
    title: 'Create camps from paste',
    message: 'This will create camp record(s) from the extracted preview below. Continue?',
    confirmLabel: 'Create camps',
    confirmClass: 'btn-primary',
  },
};

function ConfirmDialog({ action, previewSummary, onCancel, onConfirm, loading }) {
  if (!action) return null;
  const copy = CONFIRM_COPY[action];
  if (!copy) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>{copy.title}</h2>
        <p className="modal-message">{copy.message}</p>
        {action === 'process' && previewSummary && (
          <div className="modal-camp-summary-grid">
            <div className="modal-camp-summary-row">
              <span>Valid rows</span>
              <strong>{previewSummary.validBodyRows}</strong>
            </div>
            <div className="modal-camp-summary-row">
              <span>Invalid rows</span>
              <strong>{previewSummary.invalidBodyRows}</strong>
            </div>
            {previewSummary.sampleLabel && (
              <div className="modal-camp-summary-row">
                <span>Sample camp</span>
                <strong>{previewSummary.sampleLabel}</strong>
              </div>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="button" className={`btn ${copy.confirmClass}`} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working...' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function readStoredDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PASTE_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStoredDraft(draft) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PASTE_DRAFT_KEY, JSON.stringify(draft));
}

function clearStoredDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PASTE_DRAFT_KEY);
}

export default function CommunicationsPastePage() {
  const storedDraft = useMemo(() => readStoredDraft(), []);

  const [pasteText, setPasteText] = useState(storedDraft?.pasteText || '');
  const [preview, setPreview] = useState(storedDraft?.preview || null);
  const [hasExtracted, setHasExtracted] = useState(Boolean(storedDraft?.hasExtracted));
  const [savedPreviewSnapshot, setSavedPreviewSnapshot] = useState(
    storedDraft?.preview ? JSON.stringify(storedDraft.preview) : '',
  );
  const [extractionMode, setExtractionMode] = useState('preview');
  const [activeField, setActiveField] = useState(null);
  const [pendingSelection, setPendingSelection] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [createdCamps, setCreatedCamps] = useState([]);
  const [duplicateNotice, setDuplicateNotice] = useState('');
  const [autoSavePreview, setAutoSavePreview] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(PASTE_AUTO_SAVE_KEY) !== 'false';
  });
  const autoSaveTimerRef = useRef(null);

  const hasPasteText = Boolean(pasteText.trim());
  const isEditMode = extractionMode === 'edit';
  const showReadablePaste = hasPasteText && (isEditMode || hasExtracted);
  const actionLoading = extracting || processing;

  const previewDirty = useMemo(() => {
    if (!preview) return false;
    return JSON.stringify(preview) !== savedPreviewSnapshot;
  }, [preview, savedPreviewSnapshot]);

  const previewSummary = useMemo(() => {
    if (!preview?.summary) return null;
    const validBodyRows = preview.summary.validBodyRows || 0;
    const invalidBodyRows = preview.summary.invalidBodyRows || 0;
    const duplicateBodyRows = preview.summary.duplicateBodyRows
      ?? preview.bodyPreview?.filter((entry) => entry.duplicateOf).length
      ?? 0;
    const firstValidRow = preview.bodyPreview?.find((entry) => entry.valid)?.row;
    const sampleLabel = firstValidRow
      ? [firstValidRow.clientName, firstValidRow.campaignName].filter(Boolean).join(' · ') || '—'
      : null;
    const parts = [`${validBodyRows} valid row(s)`, `${invalidBodyRows} invalid row(s)`];
    if (duplicateBodyRows) {
      parts.push(`${duplicateBodyRows} duplicate(s)`);
    }

    return {
      validBodyRows,
      invalidBodyRows,
      duplicateBodyRows,
      sampleLabel,
      label: parts.join(', '),
    };
  }, [preview]);

  const hasCreatableRows = useMemo(
    () => preview?.bodyPreview?.some((entry) => entry.valid && !entry.duplicateOf) ?? false,
    [preview],
  );

  const pasteMeta = useMemo(() => {
    const lineCount = pasteText ? pasteText.split('\n').filter((line) => line.trim()).length : 0;
    return {
      lineCount,
      charCount: pasteText.length,
    };
  }, [pasteText]);

  useEffect(() => {
    setPendingSelection('');
  }, [activeField?.rowIndex, activeField?.key]);

  useEffect(() => {
    if (!isEditMode) {
      setActiveField(null);
      setPendingSelection('');
    }
  }, [isEditMode]);

  function saveDraftNow(previewToSave, { silent = false } = {}) {
    if (!previewToSave) return false;
    const snapshot = JSON.stringify(previewToSave);
    writeStoredDraft({
      pasteText,
      preview: previewToSave,
      hasExtracted,
    });
    setSavedPreviewSnapshot(snapshot);
    if (!silent) {
      setSuccess('Extraction changes saved.');
    }
    return true;
  }

  function handleSavePreview() {
    if (!preview || !previewDirty) return;
    saveDraftNow(preview);
  }

  function handleToggleAutoSave() {
    setAutoSavePreview((current) => {
      const next = !current;
      window.localStorage.setItem(PASTE_AUTO_SAVE_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    if (!autoSavePreview) {
      return undefined;
    }

    const hasDraftContent = Boolean(pasteText.trim()) || Boolean(preview);
    if (!hasDraftContent) {
      return undefined;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      writeStoredDraft({ pasteText, preview, hasExtracted });
      if (preview) {
        setSavedPreviewSnapshot(JSON.stringify(preview));
      }
    }, PREVIEW_AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSavePreview, pasteText, preview, hasExtracted]);

  function handleMouseUp() {
    if (!activeField || !showReadablePaste) return;
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      setPendingSelection(selection);
    }
  }

  function handleTextPick(selection) {
    if (!activeField || !preview?.bodyPreview) return null;
    const nextRows = preview.bodyPreview.map((entry, index) => {
      if (index !== activeField.rowIndex) return entry;
      return {
        ...entry,
        row: {
          ...(entry.row || {}),
          [activeField.key]: selection,
        },
      };
    });
    const nextPreview = { ...preview, bodyPreview: nextRows };
    setPreview(nextPreview);
    setPendingSelection('');
    setActiveField(null);
    return nextPreview;
  }

  async function handleApplyPick() {
    if (!pendingSelection) return;
    const nextPreview = handleTextPick(pendingSelection);
    if (autoSavePreview && nextPreview) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      saveDraftNow(nextPreview, { silent: true });
    }
  }

  function handleCancelPick() {
    setPendingSelection('');
    setActiveField(null);
  }

  async function handleExtract({ isReExtract = false } = {}) {
    if (!hasPasteText) return;
    if (hasExtracted && !IS_DEMO_SERVER) return;

    setExtracting(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await communicationsApi.extractManualPaste({
        text: pasteText,
      });
      setPreview(data.data);
      setHasExtracted(true);
      setSavedPreviewSnapshot(JSON.stringify(data.data));
      writeStoredDraft({
        pasteText,
        preview: data.data,
        hasExtracted: true,
      });
      setConfirmAction(null);
      setSuccess(
        isReExtract
          ? 'Camp details re-extracted (demo mode). Previous preview was replaced.'
          : 'Camp details extracted. Review the preview panel.',
      );
    } catch (err) {
      setError(err?.message || 'Failed to extract pasted content');
    } finally {
      setExtracting(false);
    }
  }

  function handleExtractClick() {
    if (!hasPasteText || actionLoading || isEditMode) return;
    if (hasExtracted && IS_DEMO_SERVER) {
      setConfirmAction('reextract');
      return;
    }
    if (!hasExtracted) {
      handleExtract();
    }
  }

  async function handleProcess() {
    if (!preview) return;
    setProcessing(true);
    setError('');
    try {
      const { data } = await communicationsApi.processManualPaste({
        previewData: preview,
        text: pasteText,
      });
      setCreatedCamps(extractCreatedCamps(data.data));
      if (data.data?.duplicates) {
        const duplicateIds = (data.data.duplicateCampIds || []).join(', ');
        setDuplicateNotice(
          `${data.data.duplicates} duplicate row(s) skipped — camp(s) already exist for the same client, division, date, and doctor${duplicateIds ? ` (${duplicateIds})` : ''}.`,
        );
      } else {
        setDuplicateNotice('');
      }
      setConfirmAction(null);
      resetPasteForm();
    } catch (err) {
      setError(err?.message || 'Failed to create camps from pasted content');
    } finally {
      setProcessing(false);
    }
  }

  function resetPasteForm() {
    setPasteText('');
    setPreview(null);
    setHasExtracted(false);
    setSavedPreviewSnapshot('');
    setExtractionMode('preview');
    setActiveField(null);
    setPendingSelection('');
    setError('');
    setSuccess('');
    setDuplicateNotice('');
    setConfirmAction(null);
    clearStoredDraft();
  }

  function handleClear() {
    setCreatedCamps([]);
    resetPasteForm();
  }

  function handleConfirmAction() {
    if (confirmAction === 'reextract') {
      handleExtract({ isReExtract: true });
      return;
    }
    if (confirmAction === 'process') {
      handleProcess();
    }
  }

  const extractDisabled = actionLoading
    || !hasPasteText
    || isEditMode
    || (hasExtracted && !IS_DEMO_SERVER);

  return (
    <div className="communications-paste-page">
      {(error || success || duplicateNotice || createdCamps.length > 0) && (
        <div className="page-alerts">
          {error && <div className="error-banner">{error}</div>}
          {success && <div className="success-banner">{success}</div>}
          {duplicateNotice && <div className="info-banner">{duplicateNotice}</div>}
          <CampCreatedBanner
            camps={createdCamps}
            onDismiss={() => setCreatedCamps([])}
          />
        </div>
      )}

      <div className="communications-paste-shell panel">
        <div className="communications-paste-header">
          <div className="communications-paste-heading">
            <span className="email-detail-eyebrow">Connectors</span>
            <h2>Manual paste</h2>
            <p className="communications-paste-subtitle">
              Paste camp details once, extract, review on the right, then create camps. Drafts auto-save locally.
            </p>
          </div>
        </div>

        <div className="communications-paste-meta">
          <div className="communications-paste-meta-item">
            <span className="email-detail-meta-label">Content</span>
            <strong>
              {hasPasteText
                ? `${pasteMeta.lineCount} line(s) · ${pasteMeta.charCount} chars`
                : 'No content pasted'}
            </strong>
          </div>
          <div className="communications-paste-meta-item">
            <span className="email-detail-meta-label">Status</span>
            {hasExtracted ? (
              <span className="status-pill status-pill-success">Extracted</span>
            ) : hasPasteText ? (
              <span className="status-pill status-pill-muted">Ready to extract</span>
            ) : (
              <span className="status-pill status-pill-muted">Awaiting paste</span>
            )}
          </div>
          <div className="communications-paste-meta-item">
            <span className="email-detail-meta-label">Preview</span>
            {previewSummary ? (
              <strong>{previewSummary.label}</strong>
            ) : (
              <strong className="meta-text">Not extracted yet</strong>
            )}
          </div>
        </div>

        <div className="email-detail-layout">
          <section className="email-detail-panel email-detail-panel-message">
            <div className="email-detail-panel-header">
              <h3>Pasted content</h3>
              <span className="meta-text">
                {showReadablePaste
                  ? 'Select text below, then press Enter or click → to insert'
                  : hasExtracted
                    ? 'Locked after extract — use Clear to start over'
                    : 'Paste text here, then extract once'}
              </span>
            </div>

            <EmailPickBuffer
              activeField={activeField}
              pendingSelection={pendingSelection}
              onApply={handleApplyPick}
              onCancel={handleCancelPick}
            />

            <div
              className={`communications-paste-editor${showReadablePaste ? ' is-pick-mode' : ''}${!hasPasteText ? ' is-empty' : ''}`}
              onMouseUp={handleMouseUp}
            >
              {showReadablePaste ? (
                <pre className="communications-paste-pre">{pasteText}</pre>
              ) : (
                <textarea
                  className="communications-paste-textarea"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={hasExtracted && !IS_DEMO_SERVER}
                  placeholder={'Paste camp details here...\n\nExample:\nDATE- 31/05/2025\nDR. NAME :- Dr Example\nDR CODE : 1005012\nADDRESS* - Example Hospital, City'}
                  spellCheck={false}
                />
              )}
            </div>
          </section>

          <section className="email-detail-panel email-detail-panel-extraction">
            <div className="email-detail-panel-header">
              <h3>Extraction preview</h3>
              <span className="meta-text">
                {previewSummary?.label || 'Parsed camp rows before import'}
              </span>
            </div>
            <EmailExtractionPanel
              preview={preview}
              onPreviewChange={setPreview}
              onActiveFieldChange={setActiveField}
              activeField={activeField}
              onModeChange={setExtractionMode}
              previewDirty={previewDirty}
              autoSavePreview={autoSavePreview}
              onToggleAutoSave={handleToggleAutoSave}
              onSavePreview={handleSavePreview}
              emptyHint='Use “Extract & preview” once to parse camp details from pasted content.'
            />
          </section>
        </div>

        <div className="email-detail-actions">
          <div className="email-detail-actions-primary">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExtractClick}
              disabled={extractDisabled}
              title={
                hasExtracted && !IS_DEMO_SERVER
                  ? 'Extraction already completed for this paste'
                  : isEditMode
                    ? 'Switch to Preview to edit pasted text'
                    : hasExtracted && IS_DEMO_SERVER
                      ? 'Demo mode: run extraction again for testing'
                      : undefined
              }
            >
              {extracting
                ? 'Extracting...'
                : hasExtracted
                  ? (IS_DEMO_SERVER ? 'Re-extract' : 'Extracted')
                  : 'Extract & preview'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfirmAction('process')}
              disabled={actionLoading || !preview || !hasCreatableRows}
              title={!hasCreatableRows && preview ? 'All valid rows match existing camps' : undefined}
            >
              Create camps
            </button>
          </div>
          <div className="email-detail-actions-secondary">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={actionLoading || (!hasPasteText && !preview)}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        action={confirmAction}
        previewSummary={previewSummary}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { communicationsApi, clientApi, clientMasterApi } from './campOpsApi.js';
import { EmailPickBuffer } from './components/EmailPickBuffer';
import { EmailExtractionPanel } from './components/EmailExtractionPanel';
import { CampCreatedBanner, extractCreatedCamps } from './components/CampCreatedBanner';
import { PasteWorkflowStepper } from './components/PasteWorkflowStepper';
import { PasteContextFields } from './components/PasteContextFields';
import PasteColumnMapper from './components/PasteColumnMapper';
import { IS_DEMO_SERVER } from './constants/roles';
import {
  parseClientMasterDivisions,
  applyClientMasterCascade,
  pickSingleOption,
  resolveCampNameOptions,
} from './utils/clientMasterCascade';
import { confirmPastePreviewDurations } from './utils/campDurationWarning';
import { bindAutofillBlock } from '../../shared/suppressBrowserAutofill.js';

const PASTE_AUTO_SAVE_KEY = 'connectorsManualPasteAutoSave';
const PASTE_DRAFT_KEY = 'connectorsManualPasteDraft';
const PREVIEW_AUTO_SAVE_DELAY_MS = 800;

const CONFIRM_COPY = {
  reextract: {
    title: 'Re-extract pasted content',
    message: 'This will run extraction again and replace the current preview. Manual edits that were not saved will be lost. Continue?',
    confirmLabel: 'Re-extract',
    confirmClass: '',
  },
  process: {
    title: 'Create camps from paste',
    message: 'This will create camp record(s) from the extracted preview below. Continue?',
    confirmLabel: 'Create camps',
    confirmClass: '',
  },
};

function ConfirmDialog({ action, previewSummary, error = '', onCancel, onConfirm, loading }) {
  if (!action) return null;
  const copy = CONFIRM_COPY[action];
  if (!copy) return null;

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onCancel}>
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
        {error ? <p className="error modal-message" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={loading}>
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

function ContextBanner({ tone, children }) {
  if (!children) return null;
  return (
    <div className={`paste-context-banner paste-context-banner--${tone}`} role="status">
      {children}
    </div>
  );
}

function readStoredDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PASTE_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.preview && !Array.isArray(draft.preview.bodyPreview)) {
      return {
        pasteText: draft.pasteText || '',
        preview: null,
        hasExtracted: false,
        clientId: draft.clientId || '',
        clientName: draft.clientName || '',
        campaignType: draft.campaignType || '',
        campaignName: draft.campaignName || '',
      };
    }
    return draft;
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
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [divisionPrograms, setDivisionPrograms] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [clientId, setClientId] = useState(storedDraft?.clientId || '');
  const [clientName, setClientName] = useState(storedDraft?.clientName || '');
  const [campaignType, setCampaignType] = useState(storedDraft?.campaignType || '');
  const [campaignName, setCampaignName] = useState(storedDraft?.campaignName || '');
  const [inputMode, setInputMode] = useState('text');
  const [fileParse, setFileParse] = useState(null);
  const [fileMapping, setFileMapping] = useState({});
  const [fileUploading, setFileUploading] = useState(false);
  const autoSaveTimerRef = useRef(null);

  const pasteDefaults = useMemo(() => ({
    clientName,
    campaignType,
    campaignName,
  }), [clientName, campaignType, campaignName]);

  const campNameOptions = useMemo(
    () => resolveCampNameOptions(divisionPrograms, campaignType, campaignName),
    [divisionPrograms, campaignType, campaignName],
  );

  const contextErrors = useMemo(() => {
    const errors = {};
    if (!clientId) errors.clientId = 'Select a client';
    if (clientId && !programsLoading && !divisionOptions.length) {
      errors.campaignType = 'No division configured in Client Master';
    } else if (clientId && !campaignType) {
      errors.campaignType = 'Select division / therapy';
    }
    if (clientId && campaignType && !programsLoading && !campNameOptions.length) {
      errors.campaignName = 'No method configured in Client Master';
    } else if (!campaignName) {
      errors.campaignName = 'Select method';
    } else if (campNameOptions.length && !campNameOptions.includes(campaignName)) {
      errors.campaignName = 'Select a method from Client Master';
    }
    return errors;
  }, [
    clientId,
    campaignType,
    campaignName,
    divisionOptions.length,
    campNameOptions,
    programsLoading,
  ]);

  const hasPasteContext = Object.keys(contextErrors).length === 0;

  const hasPasteText = inputMode === 'text' && Boolean(pasteText.trim());
  const hasFileReady = inputMode === 'file' && Boolean(fileParse?.rows?.length);
  const isEditMode = extractionMode === 'edit';
  const showReadablePaste = hasPasteText && (isEditMode || hasExtracted);
  const actionLoading = extracting || processing;

  const previewDirty = useMemo(() => {
    if (!preview) return false;
    return JSON.stringify(preview) !== savedPreviewSnapshot;
  }, [preview, savedPreviewSnapshot]);

  const previewSummary = useMemo(() => {
    if (!preview?.summary && !preview?.bodyPreview) return null;
    const bodyPreview = preview.bodyPreview || [];
    const creatable = bodyPreview.filter(
      (entry) => (entry.valid || entry.partial) && !entry.duplicateOf && !entry.historicalDateBlocked,
    );
    const validBodyRows = creatable.filter((entry) => entry.valid).length;
    const partialBodyRows = creatable.filter((entry) => entry.partial).length;
    const historicalBlocked = bodyPreview.filter((entry) => entry.historicalDateBlocked).length;
    const invalidBodyRows = (preview.summary?.invalidBodyRows || 0) + historicalBlocked;
    const duplicateBodyRows = preview.summary?.duplicateBodyRows
      ?? bodyPreview.filter((entry) => entry.duplicateOf).length
      ?? 0;
    const firstValidRow = creatable[0]?.row;
    const sampleLabel = firstValidRow
      ? [firstValidRow.clientName, firstValidRow.campaignName].filter(Boolean).join(' · ') || '—'
      : null;
    const historicalHint = historicalBlocked
      ? ` · ${historicalBlocked} blocked (camp date >2 days ago — Team Leader only)`
      : '';

    return {
      validBodyRows: validBodyRows + partialBodyRows,
      invalidBodyRows,
      partialBodyRows,
      duplicateBodyRows,
      historicalBlocked,
      sampleLabel,
      label: `${validBodyRows + partialBodyRows} importable · ${invalidBodyRows} invalid${duplicateBodyRows ? ` · ${duplicateBodyRows} duplicate` : ''}${partialBodyRows ? ` · ${partialBodyRows} partial` : ''}${historicalHint}`,
    };
  }, [preview]);

  const hasCreatableRows = useMemo(
    () => preview?.bodyPreview?.some(
      (entry) => (entry.valid || entry.partial) && !entry.duplicateOf && !entry.historicalDateBlocked,
    ) ?? false,
    [preview],
  );

  const pasteMeta = useMemo(() => {
    const lineCount = pasteText ? pasteText.split('\n').filter((line) => line.trim()).length : 0;
    return { lineCount, charCount: pasteText.length };
  }, [pasteText]);

  useEffect(() => {
    Promise.all([
      clientApi.list({ limit: 500, page: 1 }),
      clientMasterApi.list({ limit: 500, page: 1 }),
    ])
      .then(([clientRes, masterRes]) => {
        const allClients = Array.isArray(clientRes.data?.data) ? clientRes.data.data : [];
        const masters = Array.isArray(masterRes.data?.data) ? masterRes.data.data : [];
        const configuredClientIds = new Set(
          masters
            .map((row) => row.client?._id || row.clientId || row.client)
            .filter(Boolean)
            .map(String),
        );
        setClients(
          configuredClientIds.size
            ? allClients.filter((client) => configuredClientIds.has(String(client._id)))
            : allClients,
        );
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, []);

  useEffect(() => {
    if (!clientId) {
      setDivisionPrograms([]);
      setDivisionOptions([]);
      return undefined;
    }

    let cancelled = false;
    setProgramsLoading(true);
    clientMasterApi.listDivisionsByClient(clientId)
      .then(({ data }) => {
        if (cancelled) return;
        const { programs, divisions } = parseClientMasterDivisions(data);
        setDivisionPrograms(programs);
        setDivisionOptions(divisions);

        const cascaded = applyClientMasterCascade({
          programs,
          currentDivision: campaignType,
          currentMethod: campaignName,
        });
        if (cascaded.campaignType !== campaignType) {
          setCampaignType(cascaded.campaignType);
        }
        if (cascaded.campaignName !== campaignName) {
          setCampaignName(cascaded.campaignName);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDivisionPrograms([]);
          setDivisionOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setProgramsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    const match = clients.find((client) => client._id === clientId);
    if (match && match.name !== clientName) {
      setClientName(match.name);
    }
  }, [clientId, clients, clientName]);

  const currentStep = useMemo(() => {
    if (!hasExtracted) return 1;
    if (hasCreatableRows) return 3;
    return 2;
  }, [hasExtracted, hasCreatableRows]);

  const primaryHint = useMemo(() => {
    if (error) return null;
    if (!hasPasteContext) {
      return 'Select client, division / therapy, and method before pasting.';
    }
    if (!hasPasteText) return 'Step 1 — Paste camp details on the left to continue.';
    if (isEditMode) return 'Finish field edits or switch to Preview before extracting again.';
    if (!hasExtracted) return `Step 1 — ${pasteMeta.lineCount} line(s) ready. Extract to parse camp fields.`;
    if (!preview) return 'Step 2 — Extraction failed or empty. Try Clear and paste again.';
    if (previewSummary?.invalidBodyRows > 0 && !hasCreatableRows) {
      return `Step 2 — Fix ${previewSummary.invalidBodyRows} invalid row(s) in Edit mode, or clear duplicates.`;
    }
    if (!hasCreatableRows) {
      return 'Step 2 — All rows are duplicates or invalid. Adjust data or start over.';
    }
    if (previewDirty && !autoSavePreview) {
      return 'Step 3 — Save your review edits before creating camps.';
    }
    return `Step 3 — ${previewSummary?.validBodyRows ?? 0} camp(s) ready. Confirm to import.`;
  }, [
    error,
    hasPasteText,
    isEditMode,
    hasExtracted,
    preview,
    previewSummary,
    hasCreatableRows,
    previewDirty,
    autoSavePreview,
    pasteMeta.lineCount,
    hasPasteContext,
  ]);

  function buildDraftPayload(overrides = {}) {
    return {
      pasteText,
      preview,
      hasExtracted,
      clientId,
      clientName,
      campaignType,
      campaignName,
      ...overrides,
    };
  }

  function invalidateExtraction() {
    setPreview(null);
    setHasExtracted(false);
    setSavedPreviewSnapshot('');
    setFileParse(null);
    setFileMapping({});
  }

  function handleInputModeChange(mode) {
    if (mode === inputMode) return;
    invalidateExtraction();
    setPasteText('');
    setInputMode(mode);
    setError('');
  }

  function handleClientChange(nextClientId) {
    const client = clients.find((item) => item._id === nextClientId);
    invalidateExtraction();
    setClientId(nextClientId);
    setClientName(client?.name || '');
    setCampaignType('');
    setCampaignName('');
    setError('');
  }

  function handleDivisionChange(nextDivision) {
    if (nextDivision !== campaignType) invalidateExtraction();
    setCampaignType(nextDivision);
    const names = resolveCampNameOptions(divisionPrograms, nextDivision);
    setCampaignName(pickSingleOption(names));
    setError('');
  }

  function handleCampNameChange(nextCampName) {
    if (nextCampName !== campaignName) invalidateExtraction();
    setCampaignName(nextCampName);
    setError('');
  }

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
    writeStoredDraft(buildDraftPayload({ preview: previewToSave }));
    setSavedPreviewSnapshot(snapshot);
    if (!silent) setSuccess('Review changes saved.');
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
    if (!autoSavePreview) return undefined;
    const hasDraftContent = Boolean(pasteText.trim()) || Boolean(preview) || hasPasteContext;
    if (!hasDraftContent) return undefined;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      writeStoredDraft(buildDraftPayload());
      if (preview) setSavedPreviewSnapshot(JSON.stringify(preview));
    }, PREVIEW_AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [autoSavePreview, pasteText, preview, hasExtracted, clientId, clientName, campaignType, campaignName]);

  function handleMouseUp() {
    if (!activeField || !showReadablePaste) return;
    const selection = window.getSelection()?.toString().trim();
    if (selection) setPendingSelection(selection);
  }

  function handleTextPick(selection) {
    if (!activeField || !preview?.bodyPreview) return null;
    const nextRows = preview.bodyPreview.map((entry, index) => {
      if (index !== activeField.rowIndex) return entry;
      return {
        ...entry,
        row: { ...(entry.row || {}), [activeField.key]: selection },
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
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      saveDraftNow(nextPreview, { silent: true });
    }
  }

  function handleCancelPick() {
    setPendingSelection('');
    setActiveField(null);
  }

  async function handleExtract({ isReExtract = false } = {}) {
    if (!hasPasteContext) return;
    if (inputMode === 'text' && !hasPasteText) return;
    if (inputMode === 'file' && !hasFileReady) return;
    if (hasExtracted && !IS_DEMO_SERVER) return;

    setExtracting(true);
    setError('');
    setSuccess('');
    try {
      let previewData;
      if (inputMode === 'file') {
        const response = await communicationsApi.extractPasteRows({
          rows: fileParse.rows,
          headers: fileParse.headers,
          mapping: fileMapping,
          fileName: fileParse.fileName,
          sheetName: fileParse.sheetName,
          ...pasteDefaults,
        });
        previewData = response.data?.data || response.data;
      } else {
        const response = await communicationsApi.extractManualPaste({
          text: pasteText,
          ...pasteDefaults,
        });
        previewData = response.data?.data || response.data;
      }
      setPreview(previewData);
      setHasExtracted(true);
      setSavedPreviewSnapshot(JSON.stringify(previewData));
      writeStoredDraft(buildDraftPayload({ preview: previewData, hasExtracted: true }));
      setConfirmAction(null);
      setSuccess(
        isReExtract
          ? 'Preview updated from pasted content.'
          : inputMode === 'file'
            ? 'File imported — review parsed camp rows on the right.'
            : 'Extraction complete — review parsed fields on the right.',
      );
    } catch (err) {
      setError(err?.message || 'Failed to extract camp data');
    } finally {
      setExtracting(false);
    }
  }

  async function handleFileUpload(file) {
    if (!file || !hasPasteContext) return;
    setFileUploading(true);
    setError('');
    invalidateExtraction();
    try {
      const { data } = await communicationsApi.parsePasteFile(file);
      const parsed = data.data || data;
      setFileParse(parsed);
      setFileMapping(parsed.mapping || {});
      setSuccess(`Loaded ${parsed.totalRows || 0} row(s) from ${parsed.fileName || file.name}.`);
    } catch (err) {
      setError(err?.message || 'Failed to parse Excel/CSV file');
    } finally {
      setFileUploading(false);
    }
  }

  function handleExtractClick() {
    if (!hasPasteText || actionLoading || isEditMode) return;
    if (hasExtracted && IS_DEMO_SERVER) {
      setConfirmAction('reextract');
      return;
    }
    if (!hasExtracted) handleExtract();
  }

  async function handleProcess() {
    if (!preview) return;
    setProcessing(true);
    setError('');
    try {
      const { data } = await communicationsApi.processManualPaste({
        previewData: preview,
        text: pasteText,
        ...pasteDefaults,
      });
      const created = extractCreatedCamps(data.data);
      setCreatedCamps(created);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('campOps:refreshList', '1');
      }
      if (data.data?.duplicates) {
        const duplicateIds = (data.data.duplicateCampIds || []).join(', ');
        setDuplicateNotice(
          `${data.data.duplicates} duplicate row(s) skipped${duplicateIds ? ` (${duplicateIds})` : ''}.`,
        );
      } else {
        setDuplicateNotice('');
      }
      setConfirmAction(null);
      setSuccess(
        created.length === 1
          ? `Camp ${created[0].campId} created. Open it below or use View in list on the Request stage.`
          : `${created.length} camps created. Open them below or use View in list on the Request stage.`,
      );
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
    if (confirmAction === 'process') handleProcess();
  }

  const extractDisabled = actionLoading
    || !hasPasteContext
    || isEditMode
    || (inputMode === 'text' ? !hasPasteText : !hasFileReady)
    || (hasExtracted && !IS_DEMO_SERVER);

  const primaryLabel = !hasExtracted
    ? (extracting ? 'Extracting…' : 'Extract & review')
    : (processing ? 'Creating camps…' : 'Create camps');

  const primaryDisabled = !hasExtracted
    ? extractDisabled
    : (actionLoading || !preview || !hasCreatableRows);

  function handlePrimaryAction() {
    if (!hasExtracted) {
      handleExtractClick();
      return;
    }
    setError('');
    if (!confirmPastePreviewDurations(preview?.bodyPreview || [])) return;
    setConfirmAction('process');
  }

  const pasteStatusTone = !hasPasteText
    ? 'neutral'
    : !hasExtracted
      ? 'ready'
      : 'locked';

  const reviewStatusTone = !preview
    ? 'neutral'
    : hasCreatableRows
      ? 'success'
      : previewSummary?.invalidBodyRows > 0
        ? 'warning'
        : 'error';

  return (
    <div className="communications-paste-page">
      {createdCamps.length > 0 && (
        <CampCreatedBanner camps={createdCamps} onDismiss={() => setCreatedCamps([])} />
      )}

      <div className="communications-paste-shell paste-workflow-shell panel">
        <header className="paste-workflow-header">
          <div className="paste-workflow-header-copy">
            <h2 className="paste-workflow-title">Manual Paste</h2>
            <p className="paste-workflow-lead">
              Paste once, verify extracted fields, then import camps.
            </p>
          </div>
          <span className="paste-workflow-draft-badge">Draft auto-saved</span>
        </header>

        <PasteWorkflowStepper currentStep={currentStep} />

        {(error || success || duplicateNotice) && (
          <div className="paste-workflow-alerts">
            {error && <ContextBanner tone="error">{error}</ContextBanner>}
            {success && <ContextBanner tone="success">{success}</ContextBanner>}
            {duplicateNotice && <ContextBanner tone="info">{duplicateNotice}</ContextBanner>}
          </div>
        )}

        <PasteContextFields
          clients={clients}
          clientId={clientId}
          campaignType={campaignType}
          campaignName={campaignName}
          divisionOptions={divisionOptions}
          campNameOptions={campNameOptions}
          programsLoading={programsLoading}
          clientsLoading={clientsLoading}
          disabled={actionLoading || (hasExtracted && !IS_DEMO_SERVER)}
          errors={contextErrors}
          onClientChange={handleClientChange}
          onDivisionChange={handleDivisionChange}
          onCampNameChange={handleCampNameChange}
        />

        <div className="paste-input-mode-tabs page-tabs">
          <button
            type="button"
            className={`page-tab${inputMode === 'text' ? ' is-active' : ''}`}
            onClick={() => handleInputModeChange('text')}
            disabled={actionLoading || (hasExtracted && !IS_DEMO_SERVER)}
          >
            Text paste
          </button>
          <button
            type="button"
            className={`page-tab${inputMode === 'file' ? ' is-active' : ''}`}
            onClick={() => handleInputModeChange('file')}
            disabled={actionLoading || (hasExtracted && !IS_DEMO_SERVER)}
          >
            Excel / CSV
          </button>
        </div>

        <div className="paste-workflow-grid email-detail-layout">
          <section className="paste-workflow-column email-detail-panel email-detail-panel-message">
            <header className="paste-column-header">
              <div className="paste-column-heading">
                <span className="paste-column-step">1</span>
                <div>
                  <h3>Paste</h3>
                  <p className="paste-column-sub">
                    {showReadablePaste
                      ? 'Select text to fill fields in Review'
                      : 'Paste camp details from email or notes'}
                  </p>
                </div>
              </div>
              <span className={`paste-status-chip paste-status-chip--${pasteStatusTone}`}>
                {!hasPasteText && 'Empty'}
                {hasPasteText && !hasExtracted && `${pasteMeta.lineCount} lines`}
                {hasExtracted && 'Locked'}
              </span>
            </header>

            <ContextBanner tone={!hasPasteContext ? 'warning' : pasteStatusTone === 'ready' ? 'ready' : 'neutral'}>
              {!hasPasteContext && 'Complete camp context above before pasting.'}
              {hasPasteContext && inputMode === 'text' && !hasPasteText && 'Paste camp details below.'}
              {hasPasteContext && inputMode === 'text' && hasPasteText && !hasExtracted && `${pasteMeta.charCount} characters · ready to extract`}
              {hasPasteContext && inputMode === 'file' && !hasFileReady && 'Upload a CSV file below.'}
              {hasPasteContext && inputMode === 'file' && hasFileReady && !hasExtracted && `${fileParse.totalRows} row(s) loaded · map columns then extract`}
              {hasPasteContext && hasExtracted && 'Content locked after extract. Use Clear to start over.'}
            </ContextBanner>

            {inputMode === 'file' ? (
              <div className="paste-file-upload-zone">
                <p><strong>Upload camp file</strong></p>
                <p className="import-muted">Supported: .csv (preferred) or .xlsb · max 1,000 rows · max 3 MB</p>
                <label className="btn secondary">
                  Choose file
                  <input
                    type="file"
                    accept=".csv,.xlsb,text/csv"
                    disabled={!hasPasteContext || actionLoading || (hasExtracted && !IS_DEMO_SERVER)}
                    onChange={(e) => {
                      handleFileUpload(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                {fileUploading ? <p className="muted">Parsing file…</p> : null}
                {fileParse ? (
                  <p className="muted">
                    {fileParse.fileName} · {fileParse.totalRows} rows · sheet {fileParse.sheetName}
                  </p>
                ) : null}
              </div>
            ) : null}

            {inputMode === 'file' && fileParse ? (
              <PasteColumnMapper
                fields={fileParse.fields || []}
                headers={fileParse.headers || []}
                mapping={fileMapping}
                columnResults={fileParse.columnResults || []}
                disabled={actionLoading || (hasExtracted && !IS_DEMO_SERVER)}
                onMappingChange={setFileMapping}
              />
            ) : null}

            {inputMode === 'text' ? (
              <>
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
                      disabled={(hasExtracted && !IS_DEMO_SERVER) || !hasPasteContext}
                      {...bindAutofillBlock()}
                      placeholder={
                        hasPasteContext
                          ? 'DATE- 31/05/2025\nDR. NAME :- Dr Example\nDR CODE : 1005012\nADDRESS* - Example Hospital, City'
                          : 'Select client, division / therapy, and method first'
                      }
                      spellCheck={false}
                      aria-label="Camp details to paste"
                    />
                  )}
                </div>
              </>
            ) : null}
          </section>

          <section className="paste-workflow-column email-detail-panel email-detail-panel-extraction">
            <header className="paste-column-header">
              <div className="paste-column-heading">
                <span className="paste-column-step">2</span>
                <div>
                  <h3>Review</h3>
                  <p className="paste-column-sub">
                    {previewSummary?.label || 'Parsed camp rows appear here'}
                  </p>
                </div>
              </div>
              {preview && (
                <span className={`paste-status-chip paste-status-chip--${reviewStatusTone}`}>
                  {hasCreatableRows
                    ? `${previewSummary?.validBodyRows ?? 0} ready`
                    : previewSummary?.invalidBodyRows
                      ? `${previewSummary.invalidBodyRows} invalid`
                      : 'No rows'}
                </span>
              )}
            </header>

            <ContextBanner tone={reviewStatusTone}>
              {!preview && 'Run Extract & review to parse pasted content.'}
              {preview && hasCreatableRows && `${previewSummary?.validBodyRows ?? 0} camp(s) ready to import.`}
              {preview && !hasCreatableRows && previewSummary?.invalidBodyRows > 0
                && `Fix ${previewSummary.invalidBodyRows} invalid row(s) in Edit mode.`}
              {preview && !hasCreatableRows && !previewSummary?.invalidBodyRows
                && 'No importable rows — all duplicates or empty.'}
            </ContextBanner>

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
              emptyHint="Extract pasted content to see parsed camp rows here."
            />
          </section>
        </div>

        <footer className="paste-workflow-footer email-detail-actions">
          <p className="paste-workflow-footer-hint">{primaryHint}</p>
          <div className="paste-workflow-footer-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={handleClear}
              disabled={actionLoading || (!hasPasteText && !preview)}
            >
              Clear
            </button>
            {hasExtracted && IS_DEMO_SERVER && (
              <button
                type="button"
                className="btn secondary"
                onClick={handleExtractClick}
                disabled={actionLoading || !hasPasteText || isEditMode}
              >
                Re-extract
              </button>
            )}
            <button
              type="button"
              className="btn paste-workflow-primary-cta"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
              aria-describedby="paste-workflow-primary-hint"
            >
              {primaryLabel}
            </button>
          </div>
        </footer>
        <p id="paste-workflow-primary-hint" className="sr-only">{primaryHint}</p>
      </div>

      <ConfirmDialog
        action={confirmAction}
        previewSummary={previewSummary}
        error={confirmAction === 'process' ? error : ''}
        onCancel={() => {
          setConfirmAction(null);
        }}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />
    </div>
  );
}

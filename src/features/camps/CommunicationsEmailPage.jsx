import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { communicationsApi } from './campOpsApi.js';
import { CommunicationsEmailFilters } from './components/CommunicationsEmailFilters';
import { EmailBodyViewer } from './components/EmailBodyViewer';
import { EmailPickBuffer } from './components/EmailPickBuffer';
import { EmailExtractionPanel } from './components/EmailExtractionPanel';
import { CampCreatedBanner, extractCreatedCamps } from './components/CampCreatedBanner';
import { Pagination } from './components/Pagination';
import { DEFAULT_PAGE_SIZE } from './constants/pagination';
import { IS_DEMO_SERVER } from './constants/roles';
import { formatDateDDMMYYYY, formatDateRangeLabel } from './utils/dateFormat';

const PREVIEW_AUTO_SAVE_KEY = 'communicationsEmailPreviewAutoSave';
const PREVIEW_AUTO_SAVE_DELAY_MS = 800;

function listToText(values = []) {
  return (values || []).join('\n');
}

function textToList(value = '') {
  return String(value)
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const CONFIRM_COPY = {
  process: {
    title: 'Create camps from email',
    message: 'This will create camp record(s) from the extracted preview. Continue?',
    confirmLabel: 'Create camps',
    confirmClass: 'btn-primary',
  },
  archive: {
    title: 'Not a campaign email',
    message: 'Mark this email as not a campaign and move it to archive?',
    confirmLabel: 'Move to archive',
    confirmClass: 'btn-danger',
  },
};

function EmailRulesPanel({ config, onSaved, setError }) {
  const [domains, setDomains] = useState(listToText(config?.allowedDomains));
  const [senders, setSenders] = useState(listToText(config?.allowedSenders));
  const [keywords, setKeywords] = useState(listToText(config?.keywords));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDomains(listToText(config?.allowedDomains));
    setSenders(listToText(config?.allowedSenders));
    setKeywords(listToText(config?.keywords));
  }, [config]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await communicationsApi.updateEmailConfig({
        allowedDomains: textToList(domains),
        allowedSenders: textToList(senders),
        keywords: textToList(keywords),
      });
      onSaved(data.data);
    } catch (err) {
      setError(err?.message || 'Failed to save email rules');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-card communications-rules-card" onSubmit={handleSave}>
      <h3>Campaign email rules</h3>
      <p className="import-intro">
        Configure which incoming emails are treated as campaign submissions. A message must pass sender/domain rules
        and match at least one keyword (or default camp signals when keywords are empty).
      </p>
      <div className="form-grid">
        <label className="full">
          Allowed sender domains
          <textarea
            rows={4}
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="sunpharma.com&#10;cipla.com"
          />
          <small className="meta-text">One domain per line or comma-separated. Leave empty to allow any domain.</small>
        </label>
        <label className="full">
          Allowed sender emails
          <textarea
            rows={4}
            value={senders}
            onChange={(e) => setSenders(e.target.value)}
            placeholder="ops@client.com"
          />
          <small className="meta-text">Specific email addresses that may send campaign requests.</small>
        </label>
        <label className="full">
          Campaign keywords
          <textarea
            rows={4}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="camp request&#10;bmd&#10;screening"
          />
          <small className="meta-text">If set, subject or body must contain at least one keyword (unless Excel is attached).</small>
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save rules'}
        </button>
      </div>
    </form>
  );
}

function ConfirmDialog({ action, onCancel, onConfirm, loading }) {
  if (!action) return null;
  const copy = CONFIRM_COPY[action];
  if (!copy) return null;

  return (
    <div className="modal-overlay modal-overlay-nested" onClick={onCancel}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{copy.title}</h2>
        <p className="modal-message">{copy.message}</p>
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

export default function CommunicationsEmailPage() {
  const [tab, setTab] = useState('inbox');
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [candidateFilter, setCandidateFilter] = useState('all');
  const [campsFilter, setCampsFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [preview, setPreview] = useState(null);
  const [savedPreviewSnapshot, setSavedPreviewSnapshot] = useState('');
  const [savingPreview, setSavingPreview] = useState(false);
  const [autoSavePreview, setAutoSavePreview] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(PREVIEW_AUTO_SAVE_KEY) !== 'false';
  });
  const autoSaveTimerRef = useRef(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [createdCamps, setCreatedCamps] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [pendingSelection, setPendingSelection] = useState('');

  const closeEmail = useCallback(() => {
    setSelectedId(null);
    setSelectedEmail(null);
    setPreview(null);
    setSavedPreviewSnapshot('');
    setActiveField(null);
    setPendingSelection('');
    setConfirmAction(null);
  }, []);

  const previewDirty = useMemo(() => {
    if (!preview) return false;
    return JSON.stringify(preview) !== savedPreviewSnapshot;
  }, [preview, savedPreviewSnapshot]);

  const hasExtractedPreview = Boolean(preview);

  useEffect(() => {
    setPendingSelection('');
  }, [activeField?.rowIndex, activeField?.key]);

  useEffect(() => {
    loadStatus();
    loadConfig();
  }, []);

  useEffect(() => {
    if (tab !== 'rules') {
      loadMessages(page, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo);
    }
  }, [page, pageSize, tab, candidateFilter, campsFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedEmail) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (confirmAction) {
          setConfirmAction(null);
        } else {
          closeEmail();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmail, confirmAction, closeEmail]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (search.trim()) {
      chips.push({
        key: 'search',
        label: `Search: ${search.trim()}`,
        onRemove: () => {
          setSearch('');
          setPage(1);
          loadMessages(1, pageSize, tab, '', candidateFilter, campsFilter, dateFrom, dateTo);
        },
      });
    }
    if (candidateFilter !== 'all') {
      const label = candidateFilter === 'candidates' ? 'Campaign candidates' : 'Other emails';
      chips.push({
        key: 'candidate',
        label,
        onRemove: () => {
          setCandidateFilter('all');
          setPage(1);
        },
      });
    }
    if (campsFilter !== 'all') {
      chips.push({
        key: 'camps',
        label: campsFilter === 'created' ? 'Camps created' : 'No camps yet',
        onRemove: () => {
          setCampsFilter('all');
          setPage(1);
        },
      });
    }
    if (dateFrom || dateTo) {
      chips.push({
        key: 'dates',
        label: `Date: ${formatDateRangeLabel(dateFrom, dateTo)}`,
        onRemove: () => {
          setDateFrom('');
          setDateTo('');
          setPage(1);
        },
      });
    }
    return chips;
  }, [search, candidateFilter, campsFilter, dateFrom, dateTo, pageSize, tab]);

  async function loadStatus() {
    try {
      const { data } = await communicationsApi.emailStatus();
      setStatus(data.data);
    } catch (err) {
      setError(err?.message || 'Failed to load mailbox status');
    }
  }

  async function loadConfig() {
    try {
      const { data } = await communicationsApi.getEmailConfig();
      setConfig(data.data);
    } catch (err) {
      setError(err?.message || 'Failed to load email rules');
    }
  }

  async function loadMessages(
    nextPage = page,
    nextPageSize = pageSize,
    nextTab = tab,
    searchValue = search,
    nextCandidateFilter = candidateFilter,
    nextCampsFilter = campsFilter,
    nextDateFrom = dateFrom,
    nextDateTo = dateTo,
  ) {
    setLoading(true);
    try {
      const params = {
        page: nextPage,
        limit: nextPageSize,
        status: nextTab === 'archive' ? 'archived' : 'inbox',
      };
      if (searchValue.trim()) params.search = searchValue.trim();
      if (nextCandidateFilter === 'candidates') params.candidate = '1';
      if (nextCandidateFilter === 'other') params.candidate = '0';
      if (nextCampsFilter === 'created') params.camps = 'created';
      if (nextCampsFilter === 'none') params.camps = 'none';
      if (nextDateFrom) params.dateFrom = nextDateFrom;
      if (nextDateTo) params.dateTo = nextDateTo;

      const { data } = await communicationsApi.listEmailMessages(params);
      setMessages(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || null);
      setPage(nextPage);
      setPageSize(nextPageSize);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit() {
    setPage(1);
    loadMessages(1, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo);
  }

  function clearAllFilters() {
    setSearch('');
    setCandidateFilter('all');
    setCampsFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    loadMessages(1, pageSize, tab, '', 'all', 'all', '', '');
  }

  async function handleSync() {
    setSyncing(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      if (dateFrom) payload.dateFrom = dateFrom;
      if (dateTo) payload.dateTo = dateTo;
      const { data } = await communicationsApi.syncEmailMailbox(payload);
      setSuccess(data.message || 'Mailbox synced');
      if (data.data?.failed > 0) {
        setError(`${data.data.failed} email(s) could not be stored. Check server logs for details.`);
      }
      await loadStatus();
      await loadMessages(1, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo);
      setPage(1);
    } catch (err) {
      setError(err?.message || 'Failed to sync mailbox');
    } finally {
      setSyncing(false);
    }
  }

  async function openEmail(id) {
    setSelectedId(id);
    setPreview(null);
    setActiveField(null);
    setError('');
    try {
      const { data } = await communicationsApi.getEmailMessage(id);
      setSelectedEmail(data.data);
      if (data.data.previewData) {
        setPreview(data.data.previewData);
        setSavedPreviewSnapshot(JSON.stringify(data.data.previewData));
      } else {
        setSavedPreviewSnapshot('');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load email');
    }
  }

  async function handleExtract() {
    if (!selectedId) return;
    const isReExtract = hasExtractedPreview;
    if (isReExtract && !IS_DEMO_SERVER) return;

    setActionLoading(true);
    setError('');
    try {
      const payload = isReExtract ? { force: true } : {};
      const { data } = await communicationsApi.extractEmailMessage(selectedId, payload);
      setPreview(data.data);
      setSavedPreviewSnapshot(JSON.stringify(data.data));
      setSuccess(
        isReExtract
          ? 'Camp details re-extracted (demo mode). Previous preview was replaced.'
          : 'Camp details extracted. Review the preview panel.',
      );
      await loadMessages(page, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo);
    } catch (err) {
      setError(err?.message || 'Failed to extract email');
    } finally {
      setActionLoading(false);
    }
  }

  async function savePreviewNow(previewToSave, { silent = false } = {}) {
    if (!selectedId || !previewToSave) return false;

    setSavingPreview(true);
    setError('');
    try {
      const { data } = await communicationsApi.saveEmailPreview(selectedId, { previewData: previewToSave });
      const saved = data.data || previewToSave;
      const savedSnapshot = JSON.stringify(saved);
      setSavedPreviewSnapshot(savedSnapshot);
      setPreview((current) => (
        JSON.stringify(current) === JSON.stringify(previewToSave) ? saved : current
      ));
      if (!silent) {
        setSuccess('Extraction changes saved.');
      }
      return true;
    } catch (err) {
      setError(err?.message || 'Failed to save extraction preview');
      return false;
    } finally {
      setSavingPreview(false);
    }
  }

  async function handleSavePreview() {
    if (!preview || !previewDirty) return;
    await savePreviewNow(preview);
  }

  function handleToggleAutoSave() {
    setAutoSavePreview((current) => {
      const next = !current;
      window.localStorage.setItem(PREVIEW_AUTO_SAVE_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    if (!autoSavePreview || !previewDirty || !selectedId || !preview || savingPreview) {
      return undefined;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      savePreviewNow(preview, { silent: true });
    }, PREVIEW_AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSavePreview, previewDirty, selectedId, preview, savingPreview]);

  async function handleProcess() {
    if (!selectedId) return;
    setActionLoading(true);
    setError('');
    try {
      if (preview) {
        await communicationsApi.saveEmailPreview(selectedId, { previewData: preview });
      }
      const { data } = await communicationsApi.processEmailMessage(selectedId, { previewData: preview });
      setCreatedCamps(extractCreatedCamps(data.data));
      setConfirmAction(null);
      closeEmail();
      await loadStatus();
      await loadMessages(page, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo);
    } catch (err) {
      setError(err?.message || 'Failed to create camps from email');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleArchive(id = selectedId) {
    if (!id) return;
    setActionLoading(true);
    setError('');
    try {
      await communicationsApi.archiveEmailMessage(id);
      setSuccess('Email moved to archive');
      setConfirmAction(null);
      if (selectedId === id) closeEmail();
      await loadStatus();
      await loadMessages(page, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo);
    } catch (err) {
      setError(err?.message || 'Failed to archive email');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore(id) {
    if (!id) return;
    setActionLoading(true);
    setError('');
    try {
      await communicationsApi.restoreEmailMessage(id);
      setSuccess('Email restored to inbox');
      if (selectedId === id) closeEmail();
      await loadStatus();
      await loadMessages(page, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo);
    } catch (err) {
      setError(err?.message || 'Failed to restore email');
    } finally {
      setActionLoading(false);
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
      await savePreviewNow(nextPreview, { silent: true });
    }
  }

  function handleCancelPick() {
    setPendingSelection('');
    setActiveField(null);
  }

  const hasLinkedCamps = (selectedEmail?.linkedCamps || []).length > 0;
  const canCreateCamps = tab === 'inbox' && !hasLinkedCamps;

  return (
    <div className="communications-email-page">
      {(error || success || createdCamps.length > 0) && (
        <div className="page-alerts">
          {error && <div className="error-banner">{error}</div>}
          {success && <div className="success-banner">{success}</div>}
          <CampCreatedBanner
            camps={createdCamps}
            onDismiss={() => setCreatedCamps([])}
          />
        </div>
      )}

      <div className="page-tabs" role="tablist" aria-label="Email communications views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inbox'}
          className={`page-tab${tab === 'inbox' ? ' is-active' : ''}`}
          onClick={() => { setTab('inbox'); setPage(1); }}
        >
          Inbox {status ? `(${status.inboxCount})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'archive'}
          className={`page-tab${tab === 'archive' ? ' is-active' : ''}`}
          onClick={() => { setTab('archive'); setPage(1); }}
        >
          Archive {status ? `(${status.archivedCount})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rules'}
          className={`page-tab${tab === 'rules' ? ' is-active' : ''}`}
          onClick={() => setTab('rules')}
        >
          Rules
        </button>
      </div>

      {tab === 'rules' ? (
        <EmailRulesPanel config={config} onSaved={setConfig} setError={setError} />
      ) : (
        <>
          <CommunicationsEmailFilters
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={handleSearchSubmit}
            candidateFilter={candidateFilter}
            onCandidateFilterChange={(value) => { setCandidateFilter(value); setPage(1); }}
            campsFilter={campsFilter}
            onCampsFilterChange={(value) => { setCampsFilter(value); setPage(1); }}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={(value) => { setDateFrom(value); setPage(1); }}
            onDateToChange={(value) => { setDateTo(value); setPage(1); }}
            status={status}
            syncing={syncing}
            onSync={handleSync}
            activeChips={activeChips}
            onClearAll={clearAllFilters}
          />

          <div className="table-card communications-table-card">
            {loading ? (
              <div className="empty-state">Loading emails...</div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                {tab === 'archive' ? 'No archived emails.' : 'No emails in inbox. Click Sync Gmail to fetch messages.'}
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>Subject</th>
                      <th>Received</th>
                      <th>Type</th>
                      <th>Camps</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message) => (
                      <tr key={message.id}>
                        <td className="communications-cell-from">{message.from || '—'}</td>
                        <td className="communications-cell-subject">{message.subject || '—'}</td>
                        <td>{message.receivedAt ? formatDateDDMMYYYY(message.receivedAt) : '—'}</td>
                        <td>
                          {message.isCampaignCandidate ? (
                            <span className="status-pill status-pill-success">Candidate</span>
                          ) : (
                            <span className="status-pill status-pill-muted">Other</span>
                          )}
                        </td>
                        <td>
                          {message.hasLinkedCamps || message.linkedCamps?.length ? (
                            <div className="communications-camps-cell">
                              <span className="status-pill status-pill-success">Created</span>
                              {(message.linkedCamps || []).slice(0, 2).map((camp) => (
                                <Link key={camp.campId} to={`/camps/manage/${camp.id}/edit`} className="communications-camp-link">
                                  {camp.campId}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="meta-text">—</span>
                          )}
                        </td>
                        <td>
                          <div className="communications-row-actions">
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => openEmail(message.id)}>
                              View email
                            </button>
                            {tab === 'inbox' && (
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleArchive(message.id)}>
                                Archive
                              </button>
                            )}
                            {tab === 'archive' && (
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestore(message.id)}>
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Pagination
            pagination={pagination}
            pageSize={pageSize}
            onPageChange={(nextPage) => loadMessages(nextPage, pageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo)}
            onPageSizeChange={(nextPageSize) => { setPage(1); loadMessages(1, nextPageSize, tab, search, candidateFilter, campsFilter, dateFrom, dateTo); }}
            itemLabel="emails"
          />
        </>
      )}

      {selectedEmail && (
        <div className="modal-overlay" onClick={closeEmail}>
          <div className="modal-card-email" onClick={(e) => e.stopPropagation()}>
            <div className="email-detail-header">
              <div className="email-detail-heading">
                <span className="email-detail-eyebrow">Email details</span>
                <h2>{selectedEmail.subject || 'No subject'}</h2>
              </div>
              <button type="button" className="email-detail-close" onClick={closeEmail} aria-label="Close email details">
                ×
              </button>
            </div>

            <div className="email-detail-meta">
              <div className="email-detail-meta-item">
                <span className="email-detail-meta-label">From</span>
                <strong>{selectedEmail.from || '—'}</strong>
              </div>
              <div className="email-detail-meta-item">
                <span className="email-detail-meta-label">Received</span>
                <strong>{selectedEmail.receivedAt ? formatDateDDMMYYYY(selectedEmail.receivedAt) : '—'}</strong>
              </div>
              <div className="email-detail-meta-item">
                <span className="email-detail-meta-label">Classification</span>
                {selectedEmail.isCampaignCandidate ? (
                  <span className="status-pill status-pill-success">Campaign candidate</span>
                ) : (
                  <span className="status-pill status-pill-muted">Other email</span>
                )}
              </div>
            </div>

            {selectedEmail.matchSummary && (
              <div className="info-banner email-detail-banner">{selectedEmail.matchSummary}</div>
            )}

            <div className="email-detail-layout">
              <section className="email-detail-panel email-detail-panel-message">
                <div className="email-detail-panel-header">
                  <h3>Message</h3>
                  <span className="meta-text">
                    {activeField
                      ? 'Select text below, then press Enter or click → to insert'
                      : 'Edit mode: click ↖ on a field to start picking'}
                  </span>
                </div>
                <EmailPickBuffer
                  activeField={activeField}
                  pendingSelection={pendingSelection}
                  onApply={handleApplyPick}
                  onCancel={handleCancelPick}
                />
                <EmailBodyViewer
                  key={selectedId}
                  bodyText={selectedEmail.bodyText}
                  bodySegments={selectedEmail.bodySegments}
                  activeField={activeField}
                  onSelectionCapture={setPendingSelection}
                />
              </section>

              <section className="email-detail-panel email-detail-panel-extraction">
                <div className="email-detail-panel-header">
                  <h3>Extraction preview</h3>
                  <span className="meta-text">Parsed camp rows before import</span>
                </div>
                <EmailExtractionPanel
                  preview={preview}
                  linkedCamps={selectedEmail.linkedCamps}
                  onPreviewChange={setPreview}
                  onActiveFieldChange={setActiveField}
                  activeField={activeField}
                  previewDirty={previewDirty}
                  savingPreview={savingPreview}
                  autoSavePreview={autoSavePreview}
                  onToggleAutoSave={handleToggleAutoSave}
                  onSavePreview={handleSavePreview}
                />
              </section>
            </div>

            <div className="email-detail-actions">
              {tab === 'inbox' && (
                <div className="email-detail-actions-primary">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleExtract}
                    disabled={actionLoading || (hasExtractedPreview && !IS_DEMO_SERVER)}
                    title={
                      hasExtractedPreview && !IS_DEMO_SERVER
                        ? 'Extraction already completed for this email'
                        : hasExtractedPreview && IS_DEMO_SERVER
                          ? 'Demo mode: run extraction again for testing'
                          : undefined
                    }
                  >
                    {actionLoading
                      ? 'Working...'
                      : hasExtractedPreview
                        ? (IS_DEMO_SERVER ? 'Re-extract' : 'Extracted')
                        : 'Extract & preview'}
                  </button>
                  {canCreateCamps && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setConfirmAction('process')}
                      disabled={actionLoading || !preview}
                    >
                      Create camps
                    </button>
                  )}
                </div>
              )}
              <div className="email-detail-actions-secondary">
                {tab === 'inbox' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setConfirmAction('archive')}
                    disabled={actionLoading}
                  >
                    Not a campaign email
                  </button>
                )}
                {tab === 'archive' && (
                  <button type="button" className="btn btn-secondary" onClick={() => handleRestore(selectedId)} disabled={actionLoading}>
                    Restore to inbox
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={closeEmail}>Close</button>
              </div>
            </div>

            <ConfirmDialog
              action={confirmAction}
              onCancel={() => setConfirmAction(null)}
              onConfirm={() => {
                if (confirmAction === 'process') handleProcess();
                if (confirmAction === 'archive') handleArchive();
              }}
              loading={actionLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

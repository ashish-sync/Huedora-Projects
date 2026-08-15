import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import {
  apiDocToForm,
  fetchServerPdfBlob,
  issueCommercialDocument,
  isEditableStatus,
  loadCommercialDocument,
  saveCommercialDocument,
  submitCommercialDocument,
  approveCommercialDocument,
  rejectCommercialDocument,
} from './builderPersistence.js';
import {
  hasEnoughCommercialDraftContent,
  MIN_COMMERCIAL_DRAFT_ENTRIES,
} from './commercialDraftGate.js';

/**
 * Server-backed draft autosave + lifecycle for Invoice Builder document types.
 * Applies to all 8 commercial docs. New drafts are not created / autosaved until
 * ≥2 meaningful fields are filled (seed defaults do not count).
 */
export function usePersistedCommercialBuilder({
  documentType,
  slug,
  buildFreshForm,
  applyOrgMaster,
  orgMaster,
}) {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const admin = Boolean(isAdmin?.());
  const [docId, setDocId] = useState(routeId || null);
  const [status, setStatus] = useState('Draft');
  const [docMeta, setDocMeta] = useState(null);
  const [form, setForm] = useState(() => applyOrgMaster(buildFreshForm(), orgMaster));
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [loadingDoc, setLoadingDoc] = useState(Boolean(routeId));
  const [busyAction, setBusyAction] = useState('');
  const saveTimer = useRef(null);
  const saveFlashTimer = useRef(null);
  const skipNextAutosave = useRef(true);
  const formRef = useRef(form);
  const docIdRef = useRef(docId);
  const statusRef = useRef(status);
  const hydratedRef = useRef(false);

  formRef.current = form;
  docIdRef.current = docId;
  statusRef.current = status;

  useEffect(() => {
    if (!orgMaster || !isEditableStatus(statusRef.current, { isAdmin: admin })) return;
    setForm((prev) => applyOrgMaster(prev, orgMaster));
  }, [orgMaster, applyOrgMaster, admin]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!routeId) {
        setLoadingDoc(false);
        hydratedRef.current = true;
        skipNextAutosave.current = true;
        return;
      }
      setLoadingDoc(true);
      setError('');
      try {
        const doc = await loadCommercialDocument(routeId);
        if (cancelled) return;
        if (doc.documentType && doc.documentType !== documentType) {
          throw new Error('Document type does not match this builder');
        }
        const nextForm = applyOrgMaster(apiDocToForm(documentType, doc), orgMaster);
        setForm(nextForm);
        setDocId(doc._id);
        setStatus(doc.status || 'Draft');
        setDocMeta(doc);
        setSavedAt(doc.updatedAt ? new Date(doc.updatedAt) : new Date());
        skipNextAutosave.current = true;
        hydratedRef.current = true;
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load document');
          hydratedRef.current = true;
        }
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [routeId, documentType, applyOrgMaster, orgMaster]);

  const persist = useCallback(
    async (nextForm, { navigateOnCreate = true } = {}) => {
      if (!isEditableStatus(statusRef.current, { isAdmin: admin })) {
        return null;
      }
      const toSave = applyOrgMaster(nextForm, orgMaster);
      const creating = !docIdRef.current;

      // Do not create empty / near-empty drafts (open + close with < 2 fills).
      if (creating && !hasEnoughCommercialDraftContent(toSave, documentType)) {
        setSaveState('idle');
        return null;
      }

      setSaveState('saving');
      setError('');
      try {
        const row = await saveCommercialDocument(documentType, toSave, docIdRef.current);
        docIdRef.current = row._id;
        statusRef.current = row.status || 'Draft';
        setDocId(row._id);
        setStatus(row.status || 'Draft');
        setDocMeta(row);
        setSavedAt(new Date());
        setSaveState('saved');
        if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
        saveFlashTimer.current = setTimeout(() => setSaveState('idle'), 2400);
        if (navigateOnCreate && creating && row._id && routeId !== row._id) {
          navigate(`/finance-one/billing/${slug}/${row._id}`, { replace: true });
        }
        return row;
      } catch (err) {
        setSaveState('idle');
        setError(err.message || 'Save failed');
        throw err;
      }
    },
    [applyOrgMaster, documentType, navigate, orgMaster, routeId, slug, admin]
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    if (!hydratedRef.current || loadingDoc) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (!isEditableStatus(status, { isAdmin: admin })) return;

    // Skip autosave until a new draft has enough content.
    if (!docIdRef.current && !hasEnoughCommercialDraftContent(form, documentType)) {
      setSaveState('idle');
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      persistRef.current(formRef.current).catch(() => {});
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, loadingDoc, status, documentType, admin]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    return persistRef.current(formRef.current);
  }, []);

  const newDocument = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const fresh = applyOrgMaster(buildFreshForm(), orgMaster);
    skipNextAutosave.current = true;
    setForm(fresh);
    setDocId(null);
    setStatus('Draft');
    setDocMeta(null);
    setError('');
    setSaveState('idle');
    setSavedAt(null);
    navigate(`/finance-one/billing/${slug}`, { replace: true });
  }, [applyOrgMaster, buildFreshForm, navigate, orgMaster, slug]);

  const runLifecycle = useCallback(
    async (action) => {
      setBusyAction(action);
      setError('');
      try {
        let row = null;
        if (isEditableStatus(statusRef.current, { isAdmin: admin })) {
          if (
            !docIdRef.current &&
            !hasEnoughCommercialDraftContent(formRef.current, documentType)
          ) {
            throw new Error(
              `Fill at least ${MIN_COMMERCIAL_DRAFT_ENTRIES} fields (for example party name and a line description) before continuing.`
            );
          }
          row = await persistRef.current(formRef.current, { navigateOnCreate: true });
        }
        const id = row?._id || docIdRef.current;
        if (!id) {
          throw new Error(
            `Fill at least ${MIN_COMMERCIAL_DRAFT_ENTRIES} fields before continuing.`
          );
        }

        if (action === 'submit') row = await submitCommercialDocument(id);
        else if (action === 'approve') row = await approveCommercialDocument(id);
        else if (action === 'reject') row = await rejectCommercialDocument(id);
        else if (action === 'issue') row = await issueCommercialDocument(documentType, id);

        docIdRef.current = row._id;
        statusRef.current = row.status || statusRef.current;
        setDocId(row._id);
        setStatus(row.status || statusRef.current);
        setDocMeta(row);
        if (row.documentNumber) {
          setForm((prev) => {
            const next = structuredClone(prev);
            if (next.invoice) {
              next.invoice.documentNumber = row.documentNumber;
              if (row.documentDate) next.invoice.issueDate = row.documentDate;
              if (row.dueDate) next.invoice.dueDate = row.dueDate;
            }
            if (next.document) {
              next.document.documentNumber = row.documentNumber;
              if (row.documentDate) next.document.issueDate = row.documentDate;
              if (row.dueDate) next.document.dueDate = row.dueDate;
            }
            if (next.po) next.po.documentNumber = row.documentNumber;
            return next;
          });
          skipNextAutosave.current = true;
        }
        setSavedAt(new Date());
        return row;
      } catch (err) {
        setError(err.message || `${action} failed`);
        throw err;
      } finally {
        setBusyAction('');
      }
    },
    [documentType, admin]
  );

  const resolveServerPdf = useCallback(async () => {
    let row = null;
    if (isEditableStatus(statusRef.current, { isAdmin: admin })) {
      if (
        !docIdRef.current &&
        !hasEnoughCommercialDraftContent(formRef.current, documentType)
      ) {
        throw new Error(
          `Fill at least ${MIN_COMMERCIAL_DRAFT_ENTRIES} fields before exporting.`
        );
      }
      row = await persistRef.current(formRef.current);
    }
    const id = row?._id || docIdRef.current;
    if (!id) {
      throw new Error(
        `Fill at least ${MIN_COMMERCIAL_DRAFT_ENTRIES} fields before exporting.`
      );
    }
    const name = row?.documentNumber || docMeta?.documentNumber || slug;
    const fileName = `${String(name || 'document').replace(/[^\w.-]+/g, '_')}.pdf`;
    const blob = await fetchServerPdfBlob(documentType, id);
    return { blob, fileName, row };
  }, [docMeta, documentType, slug]);

  const exportServerPdf = useCallback(async () => {
    const { blob, fileName, row } = await resolveServerPdf();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return row;
  }, [resolveServerPdf]);

  const readOnly = !isEditableStatus(status, { isAdmin: admin });

  return {
    form,
    setForm,
    docId,
    status,
    docMeta,
    saveState,
    savedAt,
    error,
    setError,
    loadingDoc,
    busyAction,
    readOnly,
    saveNow,
    newDocument,
    submitDocument: () => runLifecycle('submit'),
    approveDocument: () => runLifecycle('approve'),
    rejectDocument: () => runLifecycle('reject'),
    issueDocument: () => runLifecycle('issue'),
    resolveServerPdf,
    exportServerPdf,
  };
}

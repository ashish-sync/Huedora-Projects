import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  apiDocToForm,
  downloadServerPdf,
  issueCommercialDocument,
  isEditableStatus,
  loadCommercialDocument,
  saveCommercialDocument,
  submitCommercialDocument,
  approveCommercialDocument,
  rejectCommercialDocument,
} from './builderPersistence.js';

/**
 * Server-backed draft autosave + lifecycle for Invoice Builder document types.
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
    if (!orgMaster || !isEditableStatus(statusRef.current)) return;
    setForm((prev) => applyOrgMaster(prev, orgMaster));
  }, [orgMaster, applyOrgMaster]);

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
      if (!isEditableStatus(statusRef.current)) {
        return null;
      }
      const toSave = applyOrgMaster(nextForm, orgMaster);
      setSaveState('saving');
      setError('');
      try {
        const creating = !docIdRef.current;
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
          navigate(`/finance/build/${slug}/${row._id}`, { replace: true });
        }
        return row;
      } catch (err) {
        setSaveState('idle');
        setError(err.message || 'Save failed');
        throw err;
      }
    },
    [applyOrgMaster, documentType, navigate, orgMaster, routeId, slug]
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    if (!hydratedRef.current || loadingDoc) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (!isEditableStatus(status)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      persistRef.current(formRef.current).catch(() => {});
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, loadingDoc, status]);

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
    navigate(`/finance/build/${slug}`, { replace: true });
  }, [applyOrgMaster, buildFreshForm, navigate, orgMaster, slug]);

  const runLifecycle = useCallback(async (action) => {
    setBusyAction(action);
    setError('');
    try {
      let row = null;
      if (isEditableStatus(statusRef.current)) {
        row = await persistRef.current(formRef.current, { navigateOnCreate: true });
      }
      const id = row?._id || docIdRef.current;
      if (!id) throw new Error('Save the document before continuing');

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
          if (next.invoice) next.invoice.documentNumber = row.documentNumber;
          if (next.document) next.document.documentNumber = row.documentNumber;
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
  }, [documentType]);

  const exportServerPdf = useCallback(async () => {
    let row = null;
    if (isEditableStatus(statusRef.current)) {
      row = await persistRef.current(formRef.current);
    }
    const id = row?._id || docIdRef.current;
    if (!id) throw new Error('Save the document before exporting');
    const name = row?.documentNumber || row?.docKey || docMeta?.documentNumber || slug;
    await downloadServerPdf(documentType, id, name);
    return row;
  }, [docMeta, documentType, slug]);

  const readOnly = !isEditableStatus(status);

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
    exportServerPdf,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyOrgMasterToInvoiceForm,
  loadOrgMasterCache,
} from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import {
  clearInvoiceDraft,
  defaultInvoiceForm,
  defaultLineItem,
  loadInvoiceDraft,
  MAX_INVOICE_LINE_ITEMS,
  nextInvoiceNumber,
  saveInvoiceDraft,
} from '../invoiceGenerator/invoiceStorage.js';
import { computeInvoiceTotals, usesIgst } from '../invoiceGenerator/invoiceCalculations.js';

function buildInitialForm() {
  const draft = loadInvoiceDraft();
  const base = draft || defaultInvoiceForm();
  const cached = loadOrgMasterCache();
  return applyOrgMasterToInvoiceForm(base, cached);
}

export function useInvoiceBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const [form, setForm] = useState(buildInitialForm);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);
  const saveFlashTimer = useRef(null);

  useEffect(() => {
    setForm((prev) => applyOrgMasterToInvoiceForm(prev, orgMaster));
  }, [orgMaster]);

  const totals = useMemo(() => {
    const taxMode = usesIgst(form.billTo?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
    return computeInvoiceTotals(form.lineItems, taxMode, form.adjustments || {});
  }, [form.lineItems, form.billTo?.stateCode, form.company?.stateCode, form.adjustments]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      const toSave = applyOrgMasterToInvoiceForm(form, orgMaster);
      saveInvoiceDraft(toSave);
      setSavedAt(new Date());
      setSaveState('saved');
      if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
      saveFlashTimer.current = setTimeout(() => setSaveState('idle'), 2400);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, orgMaster]);

  const update = useCallback((path, value) => {
    setForm((prev) => {
      const next = structuredClone(prev);
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i += 1) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const updateLine = useCallback((index, patch) => {
    setForm((prev) => {
      const lineItems = [...prev.lineItems];
      lineItems[index] = { ...lineItems[index], ...patch };
      return { ...prev, lineItems };
    });
  }, []);

  const addLine = useCallback(() => {
    setForm((prev) => {
      if (prev.lineItems.length >= MAX_INVOICE_LINE_ITEMS) return prev;
      return { ...prev, lineItems: [...prev.lineItems, defaultLineItem()] };
    });
  }, []);

  const removeLine = useCallback((index) => {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.length > 1 ? prev.lineItems.filter((_, i) => i !== index) : prev.lineItems,
    }));
  }, []);

  const updateTerm = useCallback((index, value) => {
    setForm((prev) => {
      const terms = [...prev.terms];
      terms[index] = value;
      return { ...prev, terms };
    });
  }, []);

  const addTerm = useCallback(() => {
    setForm((prev) => ({ ...prev, terms: [...prev.terms, ''] }));
  }, []);

  const newInvoice = useCallback(() => {
    const fresh = defaultInvoiceForm();
    fresh.invoice.documentNumber = nextInvoiceNumber(fresh.invoice.issueDate);
    const next = applyOrgMasterToInvoiceForm(fresh, orgMaster);
    setForm(next);
    saveInvoiceDraft(next);
  }, [orgMaster]);

  const clearDraft = useCallback(() => {
    clearInvoiceDraft();
    const fresh = defaultInvoiceForm();
    const next = applyOrgMasterToInvoiceForm(fresh, orgMaster);
    setForm(next);
  }, [orgMaster]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const toSave = applyOrgMasterToInvoiceForm(form, orgMaster);
    saveInvoiceDraft(toSave);
    setSavedAt(new Date());
    setSaveState('saved');
    if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
    saveFlashTimer.current = setTimeout(() => setSaveState('idle'), 2400);
    return toSave;
  }, [form, orgMaster]);

  return {
    form,
    setForm,
    totals,
    saveState,
    savedAt,
    saveNow,
    update,
    updateLine,
    addLine,
    removeLine,
    updateTerm,
    addTerm,
    newInvoice,
    clearDraft,
    orgMaster,
  };
}

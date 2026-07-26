import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyOrgMasterToPurchaseOrderForm,
  loadOrgMasterCache,
} from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import { computePurchaseOrderTotals } from './purchaseOrderCalculations.js';
import {
  clearPurchaseOrderDraft,
  defaultPoLineItem,
  defaultPurchaseOrderForm,
  loadPurchaseOrderDraft,
  MAX_PO_LINE_ITEMS,
  nextPONumber,
  savePurchaseOrderDraft,
} from './purchaseOrderStorage.js';

function buildInitialForm() {
  const draft = loadPurchaseOrderDraft();
  const base = draft || defaultPurchaseOrderForm();
  const cached = loadOrgMasterCache();
  return applyOrgMasterToPurchaseOrderForm(base, cached);
}

export function usePurchaseOrderBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const [form, setForm] = useState(buildInitialForm);
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);
  const saveFlashTimer = useRef(null);

  useEffect(() => {
    setForm((prev) => applyOrgMasterToPurchaseOrderForm(prev, orgMaster));
  }, [orgMaster]);

  const totals = useMemo(() => computePurchaseOrderTotals(form), [form]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      const toSave = applyOrgMasterToPurchaseOrderForm(form, orgMaster);
      savePurchaseOrderDraft(toSave);
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
      if (prev.lineItems.length >= MAX_PO_LINE_ITEMS) return prev;
      return { ...prev, lineItems: [...prev.lineItems, defaultPoLineItem()] };
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
      const terms = [...(prev.terms || [])];
      terms[index] = value;
      return { ...prev, terms };
    });
  }, []);

  const addTerm = useCallback(() => {
    setForm((prev) => ({ ...prev, terms: [...(prev.terms || []), ''] }));
  }, []);

  const newPurchaseOrder = useCallback(() => {
    const fresh = defaultPurchaseOrderForm();
    fresh.po.documentNumber = nextPONumber(fresh.po.documentDate);
    const next = applyOrgMasterToPurchaseOrderForm(fresh, orgMaster);
    setForm(next);
    savePurchaseOrderDraft(next);
  }, [orgMaster]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const toSave = applyOrgMasterToPurchaseOrderForm(form, orgMaster);
    savePurchaseOrderDraft(toSave);
    setSavedAt(new Date());
    setSaveState('saved');
    if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
    saveFlashTimer.current = setTimeout(() => setSaveState('idle'), 2400);
    return toSave;
  }, [form, orgMaster]);

  return {
    form,
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
    newPurchaseOrder,
    orgMaster,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyOrgMasterToProformaForm,
  loadOrgMasterCache,
} from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import { computeInvoiceTotals, usesIgst } from '../invoiceGenerator/invoiceCalculations.js';
import { proformaToInvoiceView } from './proformaFormAdapter.js';
import {
  clearProformaDraft,
  defaultLineRow,
  defaultProformaForm,
  loadProformaDraft,
  MAX_PROFORMA_LINE_ITEMS,
  nextProformaNumber,
  saveProformaDraft,
} from './proformaStorage.js';

function buildInitialForm() {
  const draft = loadProformaDraft();
  const base = draft || defaultProformaForm();
  const cached = loadOrgMasterCache();
  return applyOrgMasterToProformaForm(base, cached);
}

function countLineRows(rows) {
  return (rows || []).filter((r) => r.type === 'line').length;
}

export function useProformaBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const [form, setForm] = useState(buildInitialForm);
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);
  const saveFlashTimer = useRef(null);

  useEffect(() => {
    setForm((prev) => applyOrgMasterToProformaForm(prev, orgMaster));
  }, [orgMaster]);

  const totals = useMemo(() => {
    const view = proformaToInvoiceView(form);
    const taxMode = usesIgst(view.billTo?.stateCode, view.company?.stateCode) ? 'igst' : 'cgst_sgst';
    return computeInvoiceTotals(view.lineItems, taxMode, view.adjustments || {});
  }, [form]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      const toSave = applyOrgMasterToProformaForm(form, orgMaster);
      saveProformaDraft(toSave);
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

  const updateLine = useCallback((id, patch) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  }, []);

  const addLine = useCallback(() => {
    setForm((prev) => {
      if (countLineRows(prev.rows) >= MAX_PROFORMA_LINE_ITEMS) return prev;
      return { ...prev, rows: [...prev.rows, defaultLineRow()] };
    });
  }, []);

  const removeLine = useCallback((id) => {
    setForm((prev) => {
      const lineRows = prev.rows.filter((r) => r.type === 'line');
      if (lineRows.length <= 1) return prev;
      return { ...prev, rows: prev.rows.filter((r) => r.id !== id) };
    });
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

  const newProforma = useCallback(() => {
    const fresh = defaultProformaForm();
    fresh.document.documentNumber = nextProformaNumber(fresh.document.issueDate);
    const next = applyOrgMasterToProformaForm(fresh, orgMaster);
    setForm(next);
    saveProformaDraft(next);
  }, [orgMaster]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const toSave = applyOrgMasterToProformaForm(form, orgMaster);
    saveProformaDraft(toSave);
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
    newProforma,
    orgMaster,
  };
}

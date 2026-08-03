import { useCallback, useMemo } from 'react';
import { applyOrgMasterToInvoiceForm } from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import {
  defaultInvoiceForm,
  defaultLineItem,
  MAX_INVOICE_LINE_ITEMS,
} from '../invoiceGenerator/invoiceStorage.js';
import { computeInvoiceTotals, usesIgst } from '../invoiceGenerator/invoiceCalculations.js';
import { usePersistedCommercialBuilder } from './usePersistedCommercialBuilder.js';

const applyOrg = (form, org) => applyOrgMasterToInvoiceForm(form, org);

function freshInvoiceForm() {
  const form = defaultInvoiceForm();
  form.invoice.documentNumber = '';
  return form;
}

export function useInvoiceBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const persistence = usePersistedCommercialBuilder({
    documentType: 'client_invoice',
    slug: 'invoice',
    buildFreshForm: freshInvoiceForm,
    applyOrgMaster: applyOrg,
    orgMaster,
  });

  const { form, setForm, readOnly } = persistence;

  const totals = useMemo(() => {
    const taxMode = usesIgst(form.billTo?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
    return computeInvoiceTotals(form.lineItems, taxMode, form.adjustments || {});
  }, [form.lineItems, form.billTo?.stateCode, form.company?.stateCode, form.adjustments]);

  const update = useCallback(
    (path, value) => {
      if (readOnly) return;
      setForm((prev) => {
        const next = structuredClone(prev);
        const keys = path.split('.');
        let cur = next;
        for (let i = 0; i < keys.length - 1; i += 1) cur = cur[keys[i]];
        cur[keys[keys.length - 1]] = value;
        return next;
      });
    },
    [readOnly, setForm]
  );

  const updateLine = useCallback(
    (index, patch) => {
      if (readOnly) return;
      setForm((prev) => {
        const lineItems = [...prev.lineItems];
        lineItems[index] = { ...lineItems[index], ...patch };
        return { ...prev, lineItems };
      });
    },
    [readOnly, setForm]
  );

  const addLine = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => {
      if (prev.lineItems.length >= MAX_INVOICE_LINE_ITEMS) return prev;
      return { ...prev, lineItems: [...prev.lineItems, defaultLineItem()] };
    });
  }, [readOnly, setForm]);

  const removeLine = useCallback(
    (index) => {
      if (readOnly) return;
      setForm((prev) => ({
        ...prev,
        lineItems:
          prev.lineItems.length > 1 ? prev.lineItems.filter((_, i) => i !== index) : prev.lineItems,
      }));
    },
    [readOnly, setForm]
  );

  const updateTerm = useCallback(
    (index, value) => {
      if (readOnly) return;
      setForm((prev) => {
        const terms = [...prev.terms];
        terms[index] = value;
        return { ...prev, terms };
      });
    },
    [readOnly, setForm]
  );

  const addTerm = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, terms: [...prev.terms, ''] }));
  }, [readOnly, setForm]);

  const applyClientMasterRecipient = useCallback(
    (patch) => {
      if (readOnly || !patch) return;
      setForm((prev) => ({
        ...prev,
        clientMasterId: patch.clientMasterId || '',
        clientId: patch.clientId || '',
        billTo: { ...prev.billTo, ...(patch.billTo || {}) },
        invoice: {
          ...prev.invoice,
          projectName: patch.projectName || prev.invoice.projectName,
          placeOfSupply: patch.billTo?.address || prev.invoice.placeOfSupply,
        },
        shipTo: {
          ...prev.shipTo,
          name: patch.billTo?.name || prev.shipTo.name,
          address: patch.billTo?.address || prev.shipTo.address,
          contactPerson: patch.billTo?.contactPerson || prev.shipTo.contactPerson,
        },
      }));
    },
    [readOnly, setForm]
  );

  const clearClientMasterRecipient = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      clientMasterId: '',
      clientId: '',
    }));
  }, [readOnly, setForm]);

  return {
    ...persistence,
    totals,
    update,
    updateLine,
    addLine,
    removeLine,
    updateTerm,
    addTerm,
    applyClientMasterRecipient,
    clearClientMasterRecipient,
    newInvoice: persistence.newDocument,
    clearDraft: persistence.newDocument,
    orgMaster,
  };
}

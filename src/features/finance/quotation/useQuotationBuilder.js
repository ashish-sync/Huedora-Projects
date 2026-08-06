import { useCallback, useMemo } from 'react';
import { applyOrgMasterToInvoiceForm } from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import { computeInvoiceTotals, resolveTaxMode } from '../invoiceGenerator/invoiceCalculations.js';
import { defaultLineItem } from '../invoiceGenerator/invoiceStorage.js';
import { usePersistedCommercialBuilder } from '../builder/usePersistedCommercialBuilder.js';
import {
  applyPathUpdateWithShipToSync,
  syncShipToAfterBillToPatch,
} from '../builder/shipToSameAsBillTo.js';
import { defaultQuotationForm, MAX_QUOTATION_LINE_ITEMS } from './quotationStorage.js';

const applyOrg = (form, org) => applyOrgMasterToInvoiceForm(form, org);

function freshQuotationForm() {
  const form = defaultQuotationForm();
  form.invoice.documentNumber = '';
  return form;
}

export function useQuotationBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const persistence = usePersistedCommercialBuilder({
    documentType: 'quotation',
    slug: 'quotation',
    buildFreshForm: freshQuotationForm,
    applyOrgMaster: applyOrg,
    orgMaster,
  });

  const { form, setForm, readOnly } = persistence;

  const totals = useMemo(() => {
    const taxMode = resolveTaxMode(form.billTo?.stateCode, form.company?.stateCode);
    return computeInvoiceTotals(form.lineItems || [], taxMode, {
      cnAmount: 0,
      dnAmount: 0,
      advanceReceived: form.adjustments?.advanceReceived || 0,
      roundOff: form.adjustments?.roundOff,
    });
  }, [form.lineItems, form.billTo?.stateCode, form.company?.stateCode, form.adjustments]);

  const update = useCallback(
    (path, value) => {
      if (readOnly) return;
      setForm((prev) => applyPathUpdateWithShipToSync(prev, path, value));
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
      if (prev.lineItems.length >= MAX_QUOTATION_LINE_ITEMS) return prev;
      return {
        ...prev,
        lineItems: [...prev.lineItems, defaultLineItem({ igstRate: 18, cgstRate: 9, sgstRate: 9 })],
      };
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
      setForm((prev) => {
        const billTo = { ...prev.billTo, ...(patch.billTo || {}) };
        return {
          ...prev,
          clientMasterId: patch.clientMasterId || '',
          clientId: patch.clientId || '',
          billTo,
          shipTo: syncShipToAfterBillToPatch(prev, patch.billTo || {}),
          invoice: {
            ...prev.invoice,
            projectName: patch.projectName || prev.invoice.projectName,
            servicePeriod: patch.projectName || prev.invoice.servicePeriod,
            placeOfSupply: patch.billTo?.address || prev.invoice.placeOfSupply,
          },
        };
      });
    },
    [readOnly, setForm]
  );

  const clearClientMasterRecipient = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, clientMasterId: '', clientId: '' }));
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
    newQuotation: persistence.newDocument,
    clearDraft: persistence.newDocument,
    orgMaster,
  };
}

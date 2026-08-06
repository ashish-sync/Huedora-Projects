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
import {
  findIssuedClientInvoiceByNumber,
  invoiceDocumentDateIso,
} from '../builder/lookupTaxInvoices.js';
import {
  defaultCreditNoteForm,
  MAX_CREDIT_NOTE_LINE_ITEMS,
} from './creditNoteStorage.js';

const applyOrg = (form, org) => applyOrgMasterToInvoiceForm(form, org);

function freshCreditNoteForm() {
  const form = defaultCreditNoteForm();
  form.invoice.documentNumber = '';
  return form;
}

export function useCreditNoteBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const persistence = usePersistedCommercialBuilder({
    documentType: 'credit_note',
    slug: 'credit-note',
    buildFreshForm: freshCreditNoteForm,
    applyOrgMaster: applyOrg,
    orgMaster,
  });

  const { form, setForm, readOnly } = persistence;

  const totals = useMemo(() => {
    const taxMode = resolveTaxMode(form.billTo?.stateCode, form.company?.stateCode);
    return computeInvoiceTotals(form.lineItems, taxMode, form.adjustments || {});
  }, [form.lineItems, form.billTo?.stateCode, form.company?.stateCode, form.adjustments]);

  const update = useCallback(
    (path, value) => {
      if (readOnly) return;
      setForm((prev) => applyPathUpdateWithShipToSync(prev, path, value));

      if (path !== 'invoice.cnReference') return;
      const num = String(value || '').trim();
      if (!num) {
        setForm((prev) => ({
          ...prev,
          invoice: { ...prev.invoice, originalInvoiceDate: '' },
        }));
        return;
      }
      findIssuedClientInvoiceByNumber(num)
        .then((row) => {
          const date = invoiceDocumentDateIso(row);
          if (!date) return;
          setForm((prev) => {
            if (String(prev.invoice?.cnReference || '').trim() !== num) return prev;
            return {
              ...prev,
              invoice: { ...prev.invoice, originalInvoiceDate: date },
            };
          });
        })
        .catch(() => {});
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
      if (prev.lineItems.length >= MAX_CREDIT_NOTE_LINE_ITEMS) return prev;
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
      setForm((prev) => {
        const billTo = { ...prev.billTo, ...(patch.billTo || {}) };
        return {
          ...prev,
          clientMasterId: patch.clientMasterId || '',
          clientId: patch.clientId || '',
          billTo,
          invoice: {
            ...prev.invoice,
            projectName: patch.projectName || prev.invoice.projectName,
            placeOfSupply: patch.billTo?.address || prev.invoice.placeOfSupply,
          },
          shipTo: syncShipToAfterBillToPatch(prev, patch.billTo || {}),
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
    newCreditNote: persistence.newDocument,
    clearDraft: persistence.newDocument,
    orgMaster,
  };
}

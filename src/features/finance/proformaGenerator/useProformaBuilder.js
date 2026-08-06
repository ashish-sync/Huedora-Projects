import { useCallback, useMemo } from 'react';
import { applyOrgMasterToProformaForm } from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import { computeInvoiceTotals, resolveTaxMode } from '../invoiceGenerator/invoiceCalculations.js';
import { usePersistedCommercialBuilder } from '../builder/usePersistedCommercialBuilder.js';
import {
  applyProformaPathUpdateWithShipToSync,
  copyRecipientToShipTo,
} from '../builder/shipToSameAsBillTo.js';
import { proformaToInvoiceView } from './proformaFormAdapter.js';
import {
  defaultLineRow,
  defaultProformaForm,
  MAX_PROFORMA_LINE_ITEMS,
} from './proformaStorage.js';

const applyOrg = (form, org) => applyOrgMasterToProformaForm(form, org);

function countLineRows(rows) {
  return (rows || []).filter((r) => r.type === 'line').length;
}

function freshProformaForm() {
  const form = defaultProformaForm();
  form.document.documentNumber = '';
  return form;
}

export function useProformaBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const persistence = usePersistedCommercialBuilder({
    documentType: 'proforma',
    slug: 'proforma',
    buildFreshForm: freshProformaForm,
    applyOrgMaster: applyOrg,
    orgMaster,
  });

  const { form, setForm, readOnly } = persistence;

  const totals = useMemo(() => {
    const view = proformaToInvoiceView(form);
    const taxMode = resolveTaxMode(view.billTo?.stateCode, view.company?.stateCode);
    return computeInvoiceTotals(view.lineItems, taxMode, view.adjustments || {});
  }, [form]);

  const update = useCallback(
    (path, value) => {
      if (readOnly) return;
      setForm((prev) => applyProformaPathUpdateWithShipToSync(prev, path, value));
    },
    [readOnly, setForm]
  );

  const updateLine = useCallback(
    (id, patch) => {
      if (readOnly) return;
      setForm((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      }));
    },
    [readOnly, setForm]
  );

  const addLine = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => {
      if (countLineRows(prev.rows) >= MAX_PROFORMA_LINE_ITEMS) return prev;
      return { ...prev, rows: [...prev.rows, defaultLineRow()] };
    });
  }, [readOnly, setForm]);

  const removeLine = useCallback(
    (id) => {
      if (readOnly) return;
      setForm((prev) => {
        const lineRows = prev.rows.filter((r) => r.type === 'line');
        if (lineRows.length <= 1) return prev;
        return { ...prev, rows: prev.rows.filter((r) => r.id !== id) };
      });
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
        const recipient = {
          ...prev.recipient,
          ...(patch.recipient || {}),
          name: patch.recipient?.name || patch.billTo?.name || prev.recipient.name,
          placeOfSupply:
            patch.recipient?.placeOfSupply || patch.billTo?.address || prev.recipient.placeOfSupply,
          recipientGstin:
            patch.recipient?.recipientGstin || patch.billTo?.gstin || prev.recipient.recipientGstin,
          stateCode: patch.recipient?.stateCode || patch.billTo?.stateCode || prev.recipient.stateCode,
          stateName: patch.billTo?.stateName || prev.recipient.stateName,
          contactPerson:
            patch.recipient?.contactPerson ||
            patch.billTo?.contactPerson ||
            prev.recipient.contactPerson,
          contactEmail:
            patch.recipient?.contactEmail || patch.billTo?.email || prev.recipient.contactEmail,
          projectName: patch.projectName || prev.recipient.projectName,
        };
        return {
          ...prev,
          clientMasterId: patch.clientMasterId || '',
          clientId: patch.clientId || '',
          recipient,
          shipTo: prev.shipToSameAsBillTo
            ? copyRecipientToShipTo(recipient, prev.shipTo)
            : {
                ...prev.shipTo,
                name: patch.billTo?.name || prev.shipTo?.name || '',
                address: patch.billTo?.address || prev.shipTo?.address || '',
                contactPerson: patch.billTo?.contactPerson || prev.shipTo?.contactPerson || '',
                gstin: patch.billTo?.gstin || prev.shipTo?.gstin || '',
                stateName: patch.billTo?.stateName || prev.shipTo?.stateName || '',
                stateCode: patch.billTo?.stateCode || prev.shipTo?.stateCode || '',
              },
          document: {
            ...prev.document,
            servicePeriod: patch.projectName || prev.document.servicePeriod,
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
    newProforma: persistence.newDocument,
    orgMaster,
  };
}

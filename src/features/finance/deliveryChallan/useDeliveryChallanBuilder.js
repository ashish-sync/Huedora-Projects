import { useCallback } from 'react';
import { applyOrgMasterToInvoiceForm } from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import { clampTextLines } from '../documentGenerator/inlineEdit.jsx';
import { usePersistedCommercialBuilder } from '../builder/usePersistedCommercialBuilder.js';
import {
  defaultDeliveryChallanForm,
  defaultDeliveryChallanLine,
  MAX_DELIVERY_CHALLAN_LINE_ITEMS,
} from './deliveryChallanStorage.js';

function applyOrg(form, org) {
  const next = applyOrgMasterToInvoiceForm(form, org);
  return {
    ...next,
    from: {
      ...next.from,
      // Identity / tax / contact channels always from Organisation master
      companyName: next.company?.legalName || '',
      address: next.company?.address || '',
      gstin: next.company?.gstin || '',
      mobile: next.company?.phone || '',
      email: next.company?.email || '',
      // Contact person remains document-specific
      contactPerson: next.from?.contactPerson || '',
    },
  };
}

function freshDeliveryChallanForm() {
  const form = defaultDeliveryChallanForm();
  form.invoice.documentNumber = '';
  return form;
}

const ORG_LOCKED_FROM_PATHS = new Set([
  'from.companyName',
  'from.address',
  'from.gstin',
  'from.mobile',
  'from.email',
]);

export function useDeliveryChallanBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const persistence = usePersistedCommercialBuilder({
    documentType: 'delivery_challan',
    slug: 'delivery-challan',
    buildFreshForm: freshDeliveryChallanForm,
    applyOrgMaster: applyOrg,
    orgMaster,
  });

  const { form, setForm, readOnly } = persistence;

  const update = useCallback(
    (path, value) => {
      if (readOnly || ORG_LOCKED_FROM_PATHS.has(path) || path.startsWith('company.') || path.startsWith('bank.')) {
        return;
      }
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
        while (lineItems.length <= index) {
          lineItems.push(defaultDeliveryChallanLine());
        }
        const next = { ...patch };
        if (Object.prototype.hasOwnProperty.call(next, 'description')) {
          next.description = clampTextLines(next.description, 2);
        }
        lineItems[index] = { ...lineItems[index], ...next };
        return { ...prev, lineItems };
      });
    },
    [readOnly, setForm]
  );

  const addLine = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => {
      if (prev.lineItems.length >= MAX_DELIVERY_CHALLAN_LINE_ITEMS) return prev;
      return { ...prev, lineItems: [...prev.lineItems, defaultDeliveryChallanLine()] };
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

  const applyClientMasterRecipient = useCallback(
    (patch) => {
      if (readOnly || !patch) return;
      setForm((prev) => ({
        ...prev,
        clientMasterId: patch.clientMasterId || '',
        clientId: patch.clientId || '',
        deliverTo: {
          ...prev.deliverTo,
          name: patch.billTo?.name || prev.deliverTo.name,
          company: patch.billTo?.name || prev.deliverTo.company,
          contactPerson: patch.billTo?.contactPerson || prev.deliverTo.contactPerson,
          mobile: patch.billTo?.phone || prev.deliverTo.mobile,
          address: patch.billTo?.address || prev.deliverTo.address,
        },
      }));
    },
    [readOnly, setForm]
  );

  const clearClientMasterRecipient = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, clientMasterId: '', clientId: '' }));
  }, [readOnly, setForm]);

  return {
    ...persistence,
    form,
    update,
    updateLine,
    addLine,
    removeLine,
    applyClientMasterRecipient,
    clearClientMasterRecipient,
    newDeliveryChallan: persistence.newDocument,
    clearDraft: persistence.newDocument,
    orgMaster,
  };
}

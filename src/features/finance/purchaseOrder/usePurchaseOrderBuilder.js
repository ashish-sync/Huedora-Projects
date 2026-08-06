import { useCallback, useMemo } from 'react';
import { applyOrgMasterToPurchaseOrderForm } from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import { usePersistedCommercialBuilder } from '../builder/usePersistedCommercialBuilder.js';
import { computePurchaseOrderTotals } from './purchaseOrderCalculations.js';
import {
  defaultPoLineItem,
  defaultPurchaseOrderForm,
  MAX_PO_LINE_ITEMS,
} from './purchaseOrderStorage.js';

const applyOrg = (form, org) => applyOrgMasterToPurchaseOrderForm(form, org);

/** Identity / bank / tax fields come only from Organisation master. */
const ORG_LOCKED_PATHS = new Set([
  'buyer.companyName',
  'buyer.address',
  'buyer.gstin',
  'buyer.mobile',
  'buyer.email',
  'billing.address',
  'billing.gstin',
  'billing.state',
  'billing.stateCode',
  'billing.placeOfSupply',
  'company.legalName',
  'company.address',
  'company.gstin',
  'company.pan',
  'company.cin',
  'company.email',
  'company.phone',
  'bank.accountHolder',
  'bank.bankName',
  'bank.accountNumber',
  'bank.branchName',
  'bank.ifscCode',
]);

function freshPoForm() {
  const form = defaultPurchaseOrderForm();
  form.po.documentNumber = '';
  return form;
}

export function usePurchaseOrderBuilder() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const persistence = usePersistedCommercialBuilder({
    documentType: 'purchase_order',
    slug: 'purchase-order',
    buildFreshForm: freshPoForm,
    applyOrgMaster: applyOrg,
    orgMaster,
  });

  const { form, setForm, readOnly } = persistence;
  const totals = useMemo(() => computePurchaseOrderTotals(form), [form]);

  const update = useCallback(
    (path, value) => {
      if (readOnly || ORG_LOCKED_PATHS.has(path) || path.startsWith('company.') || path.startsWith('bank.')) {
        return;
      }
      setForm((prev) => {
        const next = structuredClone(prev);
        if (!next.authorisation) {
          next.authorisation = {
            preparedBy: { name: '', designation: '', signature: '', date: '' },
            checkedBy: { name: '', designation: '', signature: '', date: '' },
            approvedBy: { name: '', designation: '', signature: '', date: '' },
          };
        }
        if (!next.specialTerms) {
          next.specialTerms = {
            deliverySchedule: '',
            warranty: '',
            replacementPolicy: '',
            penaltyClause: '',
            inspection: '',
            documentation: '',
            otherInstructions: '',
          };
        }
        if (!next.vendorAcceptance) {
          next.vendorAcceptance = {
            acceptedBy: '',
            designation: '',
            signature: '',
            date: '',
          };
        }
        const keys = path.split('.');
        let cur = next;
        for (let i = 0; i < keys.length - 1; i += 1) {
          if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') {
            cur[keys[i]] = {};
          }
          cur = cur[keys[i]];
        }
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
          lineItems.push(defaultPoLineItem());
        }
        lineItems[index] = { ...lineItems[index], ...patch };
        return { ...prev, lineItems };
      });
    },
    [readOnly, setForm]
  );

  const addLine = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => {
      if (prev.lineItems.length >= MAX_PO_LINE_ITEMS) return prev;
      return { ...prev, lineItems: [...prev.lineItems, defaultPoLineItem()] };
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
        const terms = [...(prev.terms || [])];
        terms[index] = value;
        return { ...prev, terms };
      });
    },
    [readOnly, setForm]
  );

  const addTerm = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, terms: [...(prev.terms || []), ''] }));
  }, [readOnly, setForm]);

  const applyVendorContact = useCallback(
    (patch) => {
      if (readOnly || !patch) return;
      setForm((prev) => ({
        ...prev,
        contactId: patch.contactId || '',
        vendor: { ...prev.vendor, ...(patch.vendor || {}) },
      }));
    },
    [readOnly, setForm]
  );

  const clearVendorContact = useCallback(() => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, contactId: '' }));
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
    applyVendorContact,
    clearVendorContact,
    newPurchaseOrder: persistence.newDocument,
    orgMaster,
  };
}

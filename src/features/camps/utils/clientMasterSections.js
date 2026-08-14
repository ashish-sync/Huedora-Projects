import { parseEmailList } from '../../../shared/validation.js';
import { normalizeHealthcareWorkers } from './healthcareWorkers.js';
import { trimFormStrings } from './trimInput';
import {
  buildCampTermsPayload,
  campTermsLabel,
  normalizeCampTerms,
} from './clientMasterPo.js';
import {
  hasValidationErrors,
  validateClientMasterForm,
} from './clientMasterValidation.js';

export const CLIENT_MASTER_SECTIONS = [
  {
    id: 'clientInfo',
    title: 'Client Information',
    description: 'Company identity, display name, and active status',
    fields: ['clientName', 'clientCode', 'displayName', 'isActive'],
  },
  {
    id: 'billing',
    title: 'Billing & Tax Details',
    description: 'Invoice recipient address and tax identifiers',
    fields: [
      'billingAddress',
      'billingStateName',
      'billingStateCode',
      'billingGstin',
      'billingPan',
    ],
  },
  {
    id: 'program',
    title: 'Program Configuration',
    description: 'Division, method, service model, and camp timing',
    fields: [
      'programName',
      'campName',
      'campType',
      'healthcareWorker',
      'campDuration',
    ],
  },
  {
    id: 'spoc',
    title: 'SPOC & Communication',
    description: 'Single point of contact and program-scoped assigned users',
    fields: [
      'spocName',
      'spocNumber',
      'spocEmail',
      'requestTimeline',
      'assignedUserEmails',
    ],
  },
  {
    id: 'commercial',
    title: 'Commercial Configuration',
    description: 'Unit rates, coverage thresholds, and consumables',
    fields: [
      'executedCampUnit',
      'cancelledCampUnit',
      'otUnit',
      'minimumPatientCovered',
      'minimumKmsCovered',
      'extPatientUnit',
      'kmsUnit',
      'mappedConsumables',
    ],
  },
  {
    id: 'campTerms',
    title: 'Camp Terms',
    description: 'PO, agreement, or approval-based commercial terms',
    fields: [
      'campTerms',
      'purchaseOrders',
      'agreementStartDate',
      'agreementEffectiveDate',
      'agreementEndDate',
      'campTermsFiles',
    ],
  },
];

const STRING_FIELDS = [
  'clientName',
  'clientCode',
  'displayName',
  'billingAddress',
  'billingGstin',
  'billingPan',
  'billingStateName',
  'billingStateCode',
  'programName',
  'campName',
  'campType',
  'campDuration',
  'spocName',
  'spocNumber',
  'spocEmail',
  'requestTimeline',
  'assignedUserEmails',
  'poNumber',
  'poIssueDate',
  'poExpiryDate',
  'agreementStartDate',
  'agreementEffectiveDate',
  'agreementEndDate',
];

const NUMBER_FIELDS = [
  'executedCampUnit',
  'cancelledCampUnit',
  'otUnit',
  'minimumPatientCovered',
  'minimumKmsCovered',
  'extPatientUnit',
  'kmsUnit',
];

function sectionById(id) {
  return CLIENT_MASTER_SECTIONS.find((s) => s.id === id);
}

function pickSectionErrors(sectionId, allErrors) {
  const section = sectionById(sectionId);
  if (!section) return {};
  const picked = {};
  Object.entries(allErrors || {}).forEach(([key, message]) => {
    if (section.fields.includes(key)) {
      picked[key] = message;
      return;
    }
    if (sectionId === 'campTerms' && (key.startsWith('purchaseOrders') || key === 'campTermsFiles')) {
      picked[key] = message;
    }
  });
  return picked;
}

export function validateClientMasterSection(sectionId, form) {
  const all = validateClientMasterForm(form);
  const sectionErrors = pickSectionErrors(sectionId, all);
  if (sectionId === 'clientInfo' && !String(form.clientName || '').trim()) {
    sectionErrors.clientName = sectionErrors.clientName || 'Client name is required';
  }
  return sectionErrors;
}

export function sectionHasErrors(sectionId, form) {
  return hasValidationErrors(validateClientMasterSection(sectionId, form));
}

function applyBillingToPayload(payload, trimmed) {
  payload.billing = {
    address: trimmed.billingAddress || '',
    gstin: trimmed.billingGstin || '',
    pan: trimmed.billingPan || '',
    stateName: trimmed.billingStateName || '',
    stateCode: trimmed.billingStateCode || '',
  };
  payload.billingAddress = trimmed.billingAddress || '';
  payload.billingGstin = (trimmed.billingGstin || '').toUpperCase();
  payload.billingPan = (trimmed.billingPan || '').toUpperCase();
  payload.billingStateName = trimmed.billingStateName || '';
  payload.billingStateCode = trimmed.billingStateCode || '';
}

export function buildSectionPayload(sectionId, form, { forCreate = false } = {}) {
  const trimmed = trimFormStrings(form, STRING_FIELDS);
  const payload = {
    clientId: form.clientId || undefined,
    expectedUpdatedAt: form.updatedAt || undefined,
  };

  if (sectionId === 'clientInfo' || forCreate) {
    Object.assign(payload, {
      clientName: trimmed.clientName,
      clientCode: trimmed.clientCode,
      displayName: trimmed.displayName,
      isActive: form.isActive !== false,
    });
  }

  if (sectionId === 'billing' || forCreate) {
    applyBillingToPayload(payload, trimmed);
  }

  if (sectionId === 'program' || forCreate) {
    Object.assign(payload, {
      programName: trimmed.programName,
      campName: trimmed.campName,
      campType: trimmed.campType,
      campDuration: trimmed.campDuration,
      healthcareWorker: normalizeHealthcareWorkers(form.healthcareWorker),
      coordinatorName: '',
    });
  }

  if (sectionId === 'spoc') {
    Object.assign(payload, {
      spocName: trimmed.spocName,
      spocNumber: trimmed.spocNumber,
      spocEmail: parseEmailList(form.spocEmail).join(', '),
      requestTimeline: trimmed.requestTimeline,
      assignedUserEmails: parseEmailList(form.assignedUserEmails),
    });
  }

  if (sectionId === 'commercial') {
    NUMBER_FIELDS.forEach((field) => {
      payload[field] = trimmed[field] === '' ? 0 : Number(form[field]) || 0;
    });
    if (Array.isArray(form.mappedConsumables)) {
      payload.mappedConsumables = form.mappedConsumables;
    }
  }

  if (sectionId === 'campTerms') {
    Object.assign(
      payload,
      buildCampTermsPayload({
        ...form,
        ...trimmed,
        purchaseOrders: form.purchaseOrders,
        campTermsFiles: form.campTermsFiles,
      }),
    );
  }

  return payload;
}

function fmtStatus(active) {
  return active !== false ? 'Active' : 'Inactive';
}

function fmtList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return list.length ? list.join(', ') : '—';
}

function fmtNumber(value) {
  const text = String(value ?? '').trim();
  return text === '' ? '—' : text;
}

export function buildSectionSummary(sectionId, form) {
  switch (sectionId) {
    case 'clientInfo':
      return [
        { label: 'Client Name', value: form.clientName || '—' },
        { label: 'Client Code', value: form.clientCode || '—' },
        { label: 'Display Name', value: form.displayName || '—' },
        { label: 'Status', value: fmtStatus(form.isActive) },
      ];
    case 'billing':
      return [
        { label: 'Billing Address', value: form.billingAddress || '—', span: 2 },
        { label: 'State', value: form.billingStateName || '—' },
        { label: 'State Code', value: form.billingStateCode || '—' },
        { label: 'GSTIN', value: form.billingGstin || '—' },
        { label: 'PAN', value: form.billingPan || '—' },
      ];
    case 'program':
      return [
        { label: 'Division / Therapy', value: form.programName || '—' },
        { label: 'Method', value: form.campName || '—' },
        { label: 'Service Model', value: form.campType || '—' },
        { label: 'Healthcare Worker', value: fmtList(normalizeHealthcareWorkers(form.healthcareWorker)) },
        { label: 'Camp Duration', value: form.campDuration || '—' },
      ];
    case 'spoc':
      return [
        { label: 'SPOC Name', value: form.spocName || '—' },
        { label: 'SPOC Number', value: form.spocNumber || '—' },
        { label: 'SPOC Email', value: form.spocEmail || '—' },
        { label: 'Request Timeline', value: form.requestTimeline || '—' },
        { label: 'Assigned Users', value: form.assignedUserEmails || '—', span: 2 },
      ];
    case 'commercial':
      return [
        { label: 'Executed Camp Unit', value: fmtNumber(form.executedCampUnit) },
        { label: 'Cancelled Camp Unit', value: fmtNumber(form.cancelledCampUnit) },
        { label: 'OT Unit', value: fmtNumber(form.otUnit) },
        { label: 'Min. Patients', value: fmtNumber(form.minimumPatientCovered) },
        { label: 'Min. Kms', value: fmtNumber(form.minimumKmsCovered) },
        { label: 'Ext. Patient Unit', value: fmtNumber(form.extPatientUnit) },
        { label: 'Kms Unit', value: fmtNumber(form.kmsUnit) },
        {
          label: 'Mapped Consumables',
          value: Array.isArray(form.mappedConsumables) && form.mappedConsumables.length
            ? `${form.mappedConsumables.length} item(s)`
            : '—',
        },
      ];
    case 'campTerms': {
      const terms = normalizeCampTerms(form.campTerms);
      const rows = [{ label: 'Camp Terms', value: campTermsLabel(terms) || '—' }];
      if (terms !== 'none') {
        const start = String(form.agreementStartDate || '').trim();
        const end = String(form.agreementEndDate || '').trim();
        if (start || end || String(form.agreementEffectiveDate || '').trim()) {
          const effective = String(form.agreementEffectiveDate || '').trim();
          rows.push({
            label: 'Agreement',
            value: [start, effective, end].filter(Boolean).join(' → ') || '—',
          });
        }
        const orders = (Array.isArray(form.purchaseOrders) ? form.purchaseOrders : [])
          .filter((row) => row?.poNumber || Number(row?.poNetValue) > 0 || Number(row?.poGrossValue) > 0);
        if (orders.length) {
          const labels = orders
            .map((row) => row.poNumber || 'PO')
            .slice(0, 3)
            .join(', ');
          rows.push({
            label: 'Purchase Orders',
            value: orders.length > 3 ? `${labels} +${orders.length - 3}` : labels,
          });
        }
        const fileCount = Array.isArray(form.campTermsFiles) ? form.campTermsFiles.length : 0;
        if (fileCount) rows.push({ label: 'Attachments', value: `${fileCount} file(s)` });
      }
      return rows;
    }
    default:
      return [];
  }
}

export function validateSectionsForCreate(form) {
  return {
    ...validateClientMasterSection('clientInfo', form),
    ...validateClientMasterSection('program', form),
  };
}

export function sectionFieldKeys(sectionId) {
  return sectionById(sectionId)?.fields || [];
}

export function restoreSectionFromSnapshot(form, snapshot, sectionId) {
  const keys = sectionFieldKeys(sectionId);
  const next = { ...form };
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      next[key] = snapshot[key];
    }
  });
  if (sectionId === 'campTerms') {
    next.purchaseOrders = snapshot.purchaseOrders;
    next.campTermsFiles = snapshot.campTermsFiles;
    next.poCombinedNet = snapshot.poCombinedNet;
    next.poCombinedGst = snapshot.poCombinedGst;
    next.poCombinedGross = snapshot.poCombinedGross;
  }
  return next;
}

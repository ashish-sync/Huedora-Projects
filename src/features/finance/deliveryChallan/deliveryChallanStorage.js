import { todayIso } from '../../../shared/dateFormat.js';
import { fiscalYearLabel } from '../documentNumbering.js';

const STORAGE_KEY = 'tylo_one_delivery_challan_generator_v1';
const NUMBER_KEY = 'tylo_one_delivery_challan_number_seq';

export const MAX_DELIVERY_CHALLAN_LINE_ITEMS = 8;

export const DELIVERY_CHALLAN_DECLARATION =
  'The goods covered under this Delivery Challan are being transported for reasons other than sale and do not constitute a taxable supply under the applicable provisions of the CGST Act, 2017. This Delivery Challan is issued solely for the movement, tracking and acknowledgement of goods.';

export function defaultDeliveryChallanLine(patch = {}) {
  return {
    assetId: '',
    description: '',
    make: '',
    model: '',
    manufacturerSerialNo: '',
    qty: '',
    accessories: '',
    condition: '',
    remarks: '',
    ...patch,
  };
}

export function defaultDeliveryChallanForm() {
  const today = todayIso();
  return {
    company: {
      logoDataUrl: '',
      legalName: '',
      brandLine: '',
      address: '',
      email: '',
      phone: '',
      website: '',
      contactPerson: '',
      gstin: '',
      pan: '',
      cin: '',
      udyam: '',
      udyamLabel: '',
      stateCode: '',
    },
    clientMasterId: '',
    clientId: '',
    invoice: {
      documentNumber: '',
      issueDate: today,
      dispatchDate: today,
      expectedDeliveryDate: '',
    },
    from: {
      companyName: '',
      address: '',
      gstin: '',
      contactPerson: '',
      mobile: '',
      email: '',
    },
    deliverTo: {
      recipientType: '',
      name: '',
      company: '',
      contactPerson: '',
      mobile: '',
      address: '',
    },
    courier: {
      name: '',
      awbNo: '',
      mode: '',
      packageCount: '',
      originCity: '',
      destinationCity: '',
    },
    purposeOfMovement: '',
    lineItems: [defaultDeliveryChallanLine()],
    declaration: DELIVERY_CHALLAN_DECLARATION,
    dispatch: {
      packedBy: '',
      checkedBy: '',
      dispatchedBy: '',
    },
    acknowledgement: {
      receivedBy: '',
      receivedMobile: '',
      conditionOnReceipt: '',
      receivedDate: '',
    },
  };
}

function readSeqMap() {
  try {
    return JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    return {};
  }
}

export function peekDeliveryChallanNumber(dateIso) {
  const seqMap = readSeqMap();
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const next = (seqMap[fy] || 0) + 1;
  return `DC/${fy}/${String(next).padStart(4, '0')}`;
}

export function nextDeliveryChallanNumber(dateIso) {
  const seqMap = readSeqMap();
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const next = (seqMap[fy] || 0) + 1;
  seqMap[fy] = next;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return `DC/${fy}/${String(next).padStart(4, '0')}`;
}

export function loadDeliveryChallanDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDeliveryChallanDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearDeliveryChallanDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

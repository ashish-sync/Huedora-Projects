export const FINANCE_BUILDER_OPTIONS = [
  {
    to: '/finance/build/quotation',
    label: 'Quotation',
    code: 'QT',
    available: false,
  },
  {
    to: '/finance/build/purchase-order',
    label: 'Purchase Order',
    code: 'PO',
    available: true,
  },
  {
    to: '/finance/build/proforma',
    label: 'Proforma Invoice',
    code: 'PI',
    available: true,
  },
  {
    to: '/finance/build/invoice',
    label: 'Tax Invoice',
    code: 'IN',
    available: true,
  },
  {
    to: '/finance/build/credit-note',
    label: 'Credit Note',
    code: 'CN',
    available: true,
  },
  {
    to: '/finance/build/debit-note',
    label: 'Debit Note',
    code: 'DN',
    available: false,
  },
];

export function formatBuilderOptionLabel(item) {
  return `${item.code} – ${item.label}`;
}

export const FINANCE_BUILDER_EDITOR_PATHS = FINANCE_BUILDER_OPTIONS.filter((item) => item.available).map(
  (item) => item.to,
);

export const FINANCE_BUILDER_EDITOR_ROUTE =
  /^\/finance\/build\/(invoice|proforma|purchase-order|credit-note|quotation|debit-note)(\/[^/]+)?$/;

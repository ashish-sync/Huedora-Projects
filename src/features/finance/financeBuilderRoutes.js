export const FINANCE_BUILDER_OPTIONS = [
  {
    to: '/finance-one/billing/quotation',
    label: 'Quotation',
    code: 'QT',
    available: false,
  },
  {
    to: '/finance-one/billing/purchase-order',
    label: 'Purchase Order',
    code: 'PO',
    available: true,
  },
  {
    to: '/finance-one/billing/proforma',
    label: 'Proforma Invoice',
    code: 'PI',
    available: true,
  },
  {
    to: '/finance-one/billing/invoice',
    label: 'Tax Invoice',
    code: 'IN',
    available: true,
  },
  {
    to: '/finance-one/billing/credit-note',
    label: 'Credit Note',
    code: 'CN',
    available: true,
  },
  {
    to: '/finance-one/billing/debit-note',
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
  /^\/finance-one\/billing\/(invoice|proforma|purchase-order|credit-note|quotation|debit-note)(\/[^/]+)?$/;

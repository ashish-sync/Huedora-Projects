export const FINANCE_BUILDER_OPTIONS = [
  {
    to: '/finance/build/invoice',
    label: 'Tax Invoice',
    code: 'INV',
    desc: 'GST invoice',
  },
  {
    to: '/finance/build/proforma',
    label: 'Proforma',
    code: 'PRO',
    desc: 'Quote / estimate',
  },
  {
    to: '/finance/build/purchase-order',
    label: 'Purchase Order',
    code: 'PO',
    desc: 'Vendor PO',
  },
  {
    to: '/finance/build/credit-note',
    label: 'Credit Note',
    code: 'CN',
    desc: 'GST credit',
  },
];

export const FINANCE_BUILDER_EDITOR_PATHS = FINANCE_BUILDER_OPTIONS.map((item) => item.to);

export const FINANCE_BUILDER_EDITOR_ROUTE = /^\/finance\/build\/(invoice|proforma|purchase-order|credit-note)$/;

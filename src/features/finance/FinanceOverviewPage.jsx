import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { MODULE, NAV } from '../../shared/labels.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const QUICK_SECTIONS = [
  {
    title: 'Accounts payable',
    items: [
      {
        to: '/finance/expenses',
        name: NAV.EXPENSES,
        meta: 'Record and approve operational spend',
      },
      {
        to: '/finance/invoices',
        name: NAV.INVOICES,
        meta: 'Vendor bills and payment status',
      },
    ],
  },
  {
    title: 'Client billing',
    items: [
      {
        to: '/finance/proforma',
        name: NAV.PROFORMA,
        meta: 'Create, upload, and download client proforma invoices',
      },
      {
        to: '/finance/generate-invoice',
        name: NAV.GENERATE_INVOICE,
        meta: 'Create client invoices from camp chargesheets',
      },
    ],
  },
  {
    title: 'Procurement',
    items: [
      {
        to: '/finance/purchase-orders',
        name: NAV.PURCHASE_ORDERS,
        meta: 'Create, issue, and download vendor purchase orders',
      },
    ],
  },
];

export default function FinanceOverviewPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api('/finance/summary');
      setSummary(res.data || null);
    } catch (e) {
      setError(e.message);
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = [
    { label: 'Expenses', value: summary?.expenseCount ?? '—' },
    { label: 'Expense total', value: formatMoney(summary?.expenseTotal) },
    { label: 'Open expenses', value: summary?.expenseOpen ?? '—' },
    { label: 'Invoices', value: summary?.invoiceCount ?? '—' },
    { label: 'Invoice total', value: formatMoney(summary?.invoiceTotal) },
    { label: 'Open invoices', value: summary?.invoiceOpen ?? '—' },
    { label: 'Proforma', value: summary?.proformaCount ?? '—' },
    { label: 'Proforma total', value: formatMoney(summary?.proformaTotal) },
  ];

  return (
    <div className="finance-overview">
      <p className="muted" style={{ marginTop: 0 }}>
        {MODULE.FINANCE} summary across expenses, invoices, proforma, and purchase orders.
      </p>

      {error && (
        <div className="am-banner is-error" role="status">
          {error}
        </div>
      )}

      <div
        className="module-dash-kpis"
        data-count={kpis.length}
        role="group"
        aria-label="Finance overview"
      >
        {kpis.map((k) => (
          <div key={k.label} className="module-kpi">
            <strong>{k.value}</strong>
            <span title={k.label}>{k.label}</span>
          </div>
        ))}
      </div>

      {QUICK_SECTIONS.map((section) => (
        <section key={section.title} className="asset-type-grid" aria-label={section.title}>
          <h3 className="asset-type-grid-title">{section.title}</h3>
          <div className="asset-type-cards">
            {section.items.map((item) => (
              <Link key={item.to} to={item.to} className="asset-type-card">
                <strong className="asset-type-card-name">{item.name}</strong>
                <span className="asset-type-card-meta">{item.meta}</span>
                <span className="asset-type-card-cta">Open →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

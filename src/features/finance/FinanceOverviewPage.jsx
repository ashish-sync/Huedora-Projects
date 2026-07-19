import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { MODULE, NAV } from '../../shared/labels.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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
  ];

  return (
    <div className="finance-overview">
      <p className="muted" style={{ marginTop: 0 }}>
        {MODULE.FINANCE} summary across expenses and invoices.
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

      <div className="asset-type-cards" style={{ marginTop: 16 }}>
        <Link to="/finance/expenses" className="asset-type-card">
          <strong className="asset-type-card-name">{NAV.EXPENSES}</strong>
          <span className="asset-type-card-meta">Record and approve operational spend</span>
          <span className="asset-type-card-cta">Open →</span>
        </Link>
        <Link to="/finance/invoices" className="asset-type-card">
          <strong className="asset-type-card-name">{NAV.INVOICES}</strong>
          <span className="asset-type-card-meta">Vendor bills and payment status</span>
          <span className="asset-type-card-cta">Open →</span>
        </Link>
      </div>
    </div>
  );
}

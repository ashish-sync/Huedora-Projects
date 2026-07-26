import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import FinanceDocumentsList from './FinanceDocumentsList.jsx';

const BUILDERS = [
  {
    to: '/finance/build',
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

export default function FinanceOverviewPage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');

  return (
    <div className="finance-hub">
      <section className="finance-hub-panel card">
        <header className="finance-hub-header">
          <div className="finance-hub-header-text">
            <h2 className="finance-hub-title">Finance</h2>
            <p className="finance-hub-lead">
              Create and manage GST invoices, proformas, purchase orders, and credit notes.
            </p>
          </div>
          <Link to="/finance/master" className="btn secondary btn-compact finance-hub-org-link">
            Organisation master
          </Link>
          <Link to="/finance/camp-payouts" className="btn secondary btn-compact">
            Camp payouts
          </Link>
        </header>

        {canWrite ? (
          <div className="finance-hub-create">
            <p className="finance-hub-section-label">Create document</p>
            <div className="finance-hub-tiles">
              {BUILDERS.map((item) => (
                <Link key={item.to} to={item.to} className="finance-hub-tile">
                  <span className="finance-hub-tile-code" aria-hidden="true">
                    {item.code}
                  </span>
                  <span className="finance-hub-tile-body">
                    <span className="finance-hub-tile-label">{item.label}</span>
                    <span className="finance-hub-tile-desc">{item.desc}</span>
                  </span>
                  <span className="finance-hub-tile-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <FinanceDocumentsList embedded showCreateLink={!canWrite} />
      </section>
    </div>
  );
}

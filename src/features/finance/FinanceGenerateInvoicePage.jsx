import { useAuth } from '../../shared/auth.jsx';

export default function FinanceGenerateInvoicePage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');

  return (
    <div className="finance-generate-invoice">
      <p className="muted" style={{ marginTop: 0 }}>
        Create client invoices from executed camps and approved chargesheets.
      </p>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="empty-state">
          <h3 className="empty-state-title">Generate invoice</h3>
          <p className="muted empty-state-desc">
            Select a client and billing period to draft an invoice. Line items will pull from
            approved camp chargesheets.
          </p>
          {!canWrite && (
            <p className="meta-text" style={{ marginTop: 12 }}>
              You have view-only access. Ask an administrator for Finance write access to generate invoices.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

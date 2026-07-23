export default function CampChargesheetPage() {
  return (
    <div className="camp-module-section">
      <p className="muted camp-module-section-lead">
        Prepare and review camp chargesheets after execution. Reconcile line items before payout.
      </p>
      <div className="card camp-module-section-card">
        <div className="empty-state">
          <h3 className="empty-state-title">Chargesheet workspace</h3>
          <p className="muted empty-state-desc">
            Executed camps ready for chargesheet preparation will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}

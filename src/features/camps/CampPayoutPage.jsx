export default function CampPayoutPage() {
  return (
    <div className="camp-module-section">
      <p className="muted camp-module-section-lead">
        Track camp payouts after chargesheet approval. Monitor payment status and settlement history.
      </p>
      <div className="card camp-module-section-card">
        <div className="empty-state">
          <h3 className="empty-state-title">Payout workspace</h3>
          <p className="muted empty-state-desc">
            Approved chargesheets ready for payout will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}

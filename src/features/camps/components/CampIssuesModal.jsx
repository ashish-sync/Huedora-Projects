import ModalShell from '../../../components/ui/ModalShell.jsx';

export function CampIssuesModal({
  camp,
  blockers = [],
  onClose,
  title = 'Action blocked',
  lead = 'Resolve these items before continuing:',
  fallbackMessage = 'This action is not available for this camp right now.',
}) {
  const items = blockers.length ? blockers : [fallbackMessage];

  return (
    <ModalShell
      onClose={onClose}
      titleId="camp-issues-modal-title"
      overlayClassName="camp-ops-root camp-info-portal-root modal-overlay camp-info-modal-overlay"
      panelClassName="modal-card camp-approval-issues-modal"
    >
      <header className="camp-approval-issues-header">
        <div>
          <h2 id="camp-issues-modal-title">{title}</h2>
          {camp?.campId && <p className="camp-approval-issues-subtitle">{camp.campId}</p>}
        </div>
        <button type="button" className="camp-info-modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="camp-approval-issues-body">
        <p className="camp-approval-issues-lead">{lead}</p>
        <ul className="camp-info-blocker-list">
          {items.map((message) => (
            <li key={message} className="camp-info-blocker-item">
              <span className="camp-info-blocker-icon" aria-hidden="true">
                !
              </span>
              <span>{message}</span>
            </li>
          ))}
        </ul>
      </div>
    </ModalShell>
  );
}

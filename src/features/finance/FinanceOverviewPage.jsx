import FinanceDocumentsList from './FinanceDocumentsList.jsx';
import './finance-commercial.css';

export default function FinanceOverviewPage() {
  return (
    <div className="finance-hub">
      <section className="finance-hub-panel card">
        <FinanceDocumentsList embedded showCreateLink />
      </section>
    </div>
  );
}
import { FinanceBuilderTiles } from './FinanceBuilderTiles.jsx';
import './finance-commercial.css';

export default function FinanceBuilderPickerPage() {
  return (
    <div className="finance-hub">
      <section className="finance-hub-panel card finance-hub-panel--picker">
        <div className="finance-hub-create finance-hub-create--standalone">
          <p className="finance-hub-section-label">Create document</p>
          <p className="finance-hub-picker-lead muted">Choose a document type to open the builder.</p>
          <FinanceBuilderTiles />
        </div>
      </section>    </div>
  );
}

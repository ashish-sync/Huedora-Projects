import ClientMastersPage from './ClientMastersPage.jsx';
import './campOps.css';
import './campOps.theme.css';

/** Client Master list embedded in Master One sidebar. */
export default function ClientMasterEmbeddedPage() {
  return (
    <div className="camp-ops-root">
      <ClientMastersPage embedded />
    </div>
  );
}

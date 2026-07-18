import { MODULE } from '../../shared/labels.js';
import LogisticsMasterPage from '../logistics/LogisticsMasterPage.jsx';

/** @deprecated Route redirects to /master-data; kept for compatibility. */
export default function AssetInventoryMastersPage() {
  return (
    <LogisticsMasterPage
      scope="inventory"
      title="Inventory Masters"
      description="Products."
    />
  );
}

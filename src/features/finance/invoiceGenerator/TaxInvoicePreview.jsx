import LandscapeInvoiceLikePreview from '../shared/LandscapeInvoiceLikePreview.jsx';
import { LANDSCAPE_DOC_CONFIGS } from '../shared/landscapeDocConfigs.js';

export default function TaxInvoicePreview(props) {
  return <LandscapeInvoiceLikePreview {...props} config={LANDSCAPE_DOC_CONFIGS.invoice} />;
}

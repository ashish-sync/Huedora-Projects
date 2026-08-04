import { Navigate, useParams } from 'react-router-dom';

const BUILDER_ROUTES = {
  invoice: '/finance/build/invoice',
  proforma: '/finance/build/proforma',
  'purchase-order': '/finance/build/purchase-order',
  'credit-note': '/finance/build/credit-note',
};

/** Legacy generate routes redirect to the new document builders or finance hub. */
export default function FinanceGeneratePage() {
  const { docSlug } = useParams();
  const slug = docSlug || 'invoice';
  const target = BUILDER_ROUTES[slug];

  if (target) {
    return <Navigate to={target} replace />;
  }

  return <Navigate to="/finance/build" replace />;
}

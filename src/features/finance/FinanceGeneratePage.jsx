import { Navigate, useParams } from 'react-router-dom';

const BUILDER_ROUTES = {
  invoice: '/finance-one/billing/invoice',
  proforma: '/finance-one/billing/proforma',
  'purchase-order': '/finance-one/billing/purchase-order',
  'credit-note': '/finance-one/billing/credit-note',
};

/** Legacy generate routes redirect to the new document builders or finance hub. */
export default function FinanceGeneratePage() {
  const { docSlug } = useParams();
  const slug = docSlug || 'invoice';
  const target = BUILDER_ROUTES[slug];

  if (target) {
    return <Navigate to={target} replace />;
  }

  return <Navigate to="/finance-one/billing" replace />;
}

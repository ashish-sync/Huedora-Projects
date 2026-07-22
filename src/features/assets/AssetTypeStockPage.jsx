import { Navigate, useParams } from 'react-router-dom';
import AssetsPage from './AssetsPage.jsx';
import { slugToRegisterProductType } from './assetProductTypes.js';

/** Asset One register for Medical Device or Non-Medical Device. */
export default function AssetTypeStockPage() {
  const { typeSlug } = useParams();
  const productType = slugToRegisterProductType(typeSlug);

  if (!productType) {
    return <Navigate to="/asset-inventory" replace />;
  }

  return <AssetsPage embedded productType={productType} />;
}

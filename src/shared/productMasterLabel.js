/** Brand / Manufacturer – Model/Variant/Name (canonical display for assets & movements). */

export function productBrandLabel(product) {
  if (!product) return '';
  return String(product.brand || product.manufacturer || '').trim();
}

export function productModelLabel(product) {
  if (!product) return '';
  return String(product.model || product.partNumber || product.name || '').trim();
}

/** Full asset name: "Brand - Model" */
export function productAssetName(product) {
  if (!product) return '';
  const brand = productBrandLabel(product);
  const model = productModelLabel(product);
  if (brand && model) return `${brand} - ${model}`;
  return model || brand || '';
}

/** Dropdown label for Model/Variant/Name picker */
export function productOptionLabel(product) {
  if (!product) return '';
  const model = productModelLabel(product);
  if (!model) return product.code ? String(product.code) : '';
  return product.code ? `${model} (${product.code})` : model;
}

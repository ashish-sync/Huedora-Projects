/** Product Master display helpers for assets, movements, and pickers. */

export function productBrandLabel(product) {
  if (!product) return '';
  return String(product.brand || product.manufacturer || '').trim();
}

export function productModelLabel(product) {
  if (!product) return '';
  return String(product.model || product.partNumber || '').trim();
}

/** Product Master Display Name (`name`), with Brand — Model fallback. */
export function productDisplayName(product) {
  if (!product) return '';
  const display = String(product.name || '').trim();
  if (display) return display;
  const brand = productBrandLabel(product);
  const model = productModelLabel(product);
  if (brand && model) return `${brand} — ${model}`;
  return model || brand || '';
}

/** Canonical name stored on assets / movements. */
export function productAssetName(product) {
  return productDisplayName(product);
}

/** Dropdown label: Display Name (code). */
export function productOptionLabel(product) {
  if (!product) return '';
  const display = productDisplayName(product);
  if (!display) return product.code ? String(product.code) : '';
  return product.code ? `${display} (${product.code})` : display;
}

import { useEffect, useMemo, useState } from 'react';
import { campApi } from '../campOpsApi.js';

export function ClientMasterConsumablesField({ value = [], onChange, disabled = false }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await campApi.consumableOptions();
        if (!active) return;
        setOptions(res.data?.data || []);
      } catch (err) {
        if (active) setError(err.message || 'Could not load consumables');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedIds = new Set((value || []).map((item) => String(item.productId)));

  const availableOptions = useMemo(
    () => options.filter((product) => !selectedIds.has(String(product.id))),
    [options, selectedIds],
  );

  function addProduct(productId) {
    const product = options.find((item) => String(item.id) === String(productId));
    if (!product || selectedIds.has(String(productId))) return;
    onChange?.([
      ...(value || []),
      {
        productId: String(product.id),
        itemName: product.name,
        unit: product.unit || '',
        uomId: product.uomId || '',
      },
    ]);
  }

  function removeProduct(productId) {
    onChange?.((value || []).filter((item) => String(item.productId) !== String(productId)));
  }

  return (
    <div className="client-master-consumables-field">
      <span className="client-master-field-label">Mapped Consumables</span>
      {loading ? <p className="meta-text">Loading consumables…</p> : null}
      {error ? <p className="meta-text camp-consumables-used-error">{error}</p> : null}
      {!loading && !options.length ? (
        <p className="meta-text">No consumables found in Product Master.</p>
      ) : null}
      {!loading && options.length ? (
        <select
          className="client-master-consumables-select"
          value=""
          disabled={disabled || !availableOptions.length}
          onChange={(e) => {
            const productId = e.target.value;
            if (productId) addProduct(productId);
          }}
        >
          <option value="">
            {availableOptions.length ? 'Select consumable…' : 'All consumables mapped'}
          </option>
          {availableOptions.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.unit ? ` (${product.unit})` : ''}
            </option>
          ))}
        </select>
      ) : null}
      <div className="client-master-consumables-pills" aria-live="polite">
        {(value || []).map((item) => (
          <span key={item.productId} className="client-master-consumable-pill">
            <span className="client-master-consumable-pill-label">
              {item.itemName}
              {item.unit ? ` (${item.unit})` : ''}
            </span>
            <button
              type="button"
              className="client-master-consumable-pill-remove"
              disabled={disabled}
              aria-label={`Remove ${item.itemName}`}
              onClick={() => removeProduct(item.productId)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {!loading && options.length && !(value || []).length ? (
        <p className="meta-text client-master-consumables-empty">No consumables mapped yet.</p>
      ) : null}
    </div>
  );
}

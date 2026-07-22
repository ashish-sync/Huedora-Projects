import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { MODULE, NAV } from '../../shared/labels.js';
import {
  ASSET_REGISTER_PRODUCT_TYPES,
  ALL_PRODUCT_TYPES,
  productTypeToSlug,
} from './assetProductTypes.js';

export default function AssetOverviewPage() {
  const [counts, setCounts] = useState(
    Object.fromEntries(ASSET_REGISTER_PRODUCT_TYPES.map((t) => [t, null]))
  );
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const results = await Promise.all(
        ASSET_REGISTER_PRODUCT_TYPES.map((type) =>
          api(`/assets?limit=1&page=1&productType=${encodeURIComponent(type)}`)
            .then((res) => [type, res.meta?.total ?? res.total ?? 0])
            .catch(() => [type, null])
        )
      );
      setCounts(Object.fromEntries(results));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(
    () =>
      ASSET_REGISTER_PRODUCT_TYPES.map((type) => ({
        label: type,
        value: counts[type] != null ? counts[type].toLocaleString() : '—',
      })),
    [counts]
  );

  return (
    <div className="asset-overview">
      <div className="asset-split-callout" role="note">
        <div>
          <strong>Two different jobs</strong>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            <strong>{MODULE.ASSET_INVENTORY}</strong> tracks agreements and custody for{' '}
            <strong>Medical Device</strong> and <strong>Non-Medical Device</strong> only.
          </p>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            <strong>{MODULE.LOGISTICS}</strong> → <strong>{NAV.GOODS_RECEIPT}</strong> records
            inward for <strong>all</strong> product types (
            {ALL_PRODUCT_TYPES.join(', ')}).
          </p>
        </div>
        <Link className="btn" to="/logistics/inward">
          Open Goods Receipt
        </Link>
      </div>

      {error && (
        <div className="am-banner is-error" role="status">
          {error}
        </div>
      )}

      <div
        className="module-dash-kpis"
        data-count={kpis.length}
        role="group"
        aria-label="Register counts"
      >
        {kpis.map((k) => (
          <div key={k.label} className="module-kpi">
            <strong>{k.value}</strong>
            <span title={k.label}>{k.label}</span>
          </div>
        ))}
      </div>

      <section className="asset-type-grid" aria-label="Device registers">
        <h3 className="asset-type-grid-title">Device registers (agreements &amp; custody)</h3>
        <div className="asset-type-cards">
          {ASSET_REGISTER_PRODUCT_TYPES.map((type) => (
            <Link
              key={type}
              to={`/asset-inventory/types/${productTypeToSlug(type)}`}
              className="asset-type-card"
            >
              <strong className="asset-type-card-name">{type}</strong>
              <span className="asset-type-card-meta">
                {counts[type] != null
                  ? `${counts[type].toLocaleString()} in register`
                  : 'Agreements, custody, custodian'}
              </span>
              <span className="asset-type-card-cta">Open register →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="asset-register-block" aria-label="Other product types">
        <h3 className="asset-type-grid-title">Other product types</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Peripheral Device, Accessory, Spare Part, Consumable, Document, and Other are received
          and issued in {MODULE.LOGISTICS}. They do not use the agreement / custody register.
        </p>
        <Link className="btn secondary" to="/logistics/inward">
          Record inward in {NAV.GOODS_RECEIPT}
        </Link>
      </section>
    </div>
  );
}

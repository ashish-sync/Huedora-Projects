import { Link } from 'react-router-dom';
import DateInput from '../../components/ui/DateInput.jsx';
import { EmptyState } from '../../components/ui/PageShell.jsx';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';

function formatInr(n) {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₹${value.toLocaleString('en-IN')}`;
  }
}

function formatQty(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function formatPct(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
}

function KpiTile({ to, label, qty, value, pctQty, pctValue, showValue, meta }) {
  const body = (
    <>
      <span className="ops-ov-tile-label">{label}</span>
      <span className="ops-ov-tile-qty">{formatQty(qty)}</span>
      <span className="ops-ov-tile-meta">
        {showValue && value != null ? <em>{formatInr(value)}</em> : null}
        {pctQty != null ? <span>{formatPct(pctQty)} qty</span> : null}
        {showValue && pctValue != null ? <span>{formatPct(pctValue)} value</span> : null}
        {meta ? <span>{meta}</span> : null}
      </span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="ops-ov-tile">
        {body}
      </Link>
    );
  }
  return <div className="ops-ov-tile ops-ov-tile--static">{body}</div>;
}

function ModuleCard({ title, subtitle, children }) {
  return (
    <section className="ops-ov-module" aria-label={title}>
      <header className="ops-ov-module-head">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="ops-ov-module-body">{children}</div>
    </section>
  );
}

export default function OpsOverviewBoard({
  data,
  loading,
  error,
  showValue,
  from,
  to,
  preset,
  presets,
  onFrom,
  onTo,
  onPreset,
  onRefresh,
}) {
  const modules = data?.modules;

  return (
    <div className="ops-overview ops-ov">
      <section className="ops-ov-filters" aria-label="Reporting period">
        <div className="ops-ov-filter-row">
          <label className="ops-ov-field">
            <span>Date From</span>
            <DateInput
              hideLabel
              aria-label="Date From"
              value={from || ''}
              max={to || undefined}
              onChange={onFrom}
            />
          </label>
          <label className="ops-ov-field">
            <span>Date To</span>
            <DateInput
              hideLabel
              aria-label="Date To"
              value={to || ''}
              min={from || undefined}
              onChange={onTo}
            />
          </label>
          <label className="ops-ov-field">
            <span>Preset</span>
            <select
              className="adaptive-select"
              value={preset || 'custom'}
              onChange={(e) => onPreset(e.target.value)}
              aria-label="Date preset"
            >
              {(presets || []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={loading}
            onClick={onRefresh}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="ops-ov-filter-hint muted">
          Period KPIs use Date From / Date To. Asset status is a current-state snapshot. Movement combines all warehouses.
        </p>
      </section>

      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}

      {loading && !modules ? (
        <div className="ops-ov-skel" aria-busy="true" aria-label="Loading overview KPIs">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ops-skel ops-skel--panel" />
          ))}
        </div>
      ) : null}

      {!loading && !modules && !error ? (
        <EmptyState
          title="No overview KPIs"
          description="Refresh to load module KPIs for the selected period."
          action={(
            <button type="button" className="btn btn--primary" onClick={onRefresh}>
              Refresh
            </button>
          )}
        />
      ) : null}

      {modules ? (
        <>
          {Array.isArray(data.limitations) && data.limitations.length ? (
            <details className="ops-ov-limits">
              <summary>Data limitations</summary>
              <ul>
                {data.limitations.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="ops-ov-grid">
            <ModuleCard
              title="Asset One"
              subtitle={showValue ? 'Quantity · Value · % of inventory' : 'Quantity · % of inventory'}
            >
              <div className="ops-ov-tiles">
                {(modules.assetOne?.statuses || []).map((row) => (
                  <KpiTile
                    key={row.status}
                    to={row.href}
                    label={row.status}
                    qty={row.qty}
                    value={row.value}
                    pctQty={row.pctQty}
                    pctValue={row.pctValue}
                    showValue={showValue}
                  />
                ))}
              </div>
            </ModuleCard>

            <ModuleCard title="Verification One" subtitle="Safe · Caution · Danger">
              <div className="ops-ov-tiles">
                {(modules.verificationOne?.conditions || []).map((row) => (
                  <KpiTile
                    key={row.key}
                    to={row.href}
                    label={row.label}
                    qty={row.qty}
                    value={row.value}
                    pctQty={row.pctQty}
                    pctValue={row.pctValue}
                    showValue={showValue}
                  />
                ))}
              </div>
            </ModuleCard>

            <ModuleCard title="Camp One" subtitle="Chargeability · Cancellation · Punctuality">
              <h4 className="ops-ov-subhead">Chargeability</h4>
              <div className="ops-ov-tiles">
                {(modules.campOne?.chargeability || []).map((row) => (
                  <KpiTile
                    key={`charge-${row.key}`}
                    to={row.href}
                    label={row.label}
                    qty={row.qty}
                    pctQty={row.pct}
                    showValue={false}
                  />
                ))}
              </div>
              <h4 className="ops-ov-subhead">Cancellation</h4>
              <div className="ops-ov-tiles">
                <KpiTile
                  to={modules.campOne?.cancellation?.byTylo?.href}
                  label="Cancelled by Tylo"
                  qty={modules.campOne?.cancellation?.byTylo?.qty}
                  pctQty={modules.campOne?.cancellation?.byTylo?.pct}
                  showValue={false}
                />
                <KpiTile
                  to={modules.campOne?.cancellation?.byClient?.href}
                  label="Cancelled by Client"
                  qty={modules.campOne?.cancellation?.byClient?.qty}
                  pctQty={modules.campOne?.cancellation?.byClient?.pct}
                  showValue={false}
                />
                <KpiTile
                  to={modules.campOne?.cancellation?.href}
                  label="Cancellation rate"
                  qty={modules.campOne?.cancellation?.cancelledTotal}
                  pctQty={modules.campOne?.cancellation?.ratePct}
                  showValue={false}
                  meta={`of ${formatQty(modules.campOne?.cancellation?.eligibleTotal || 0)} eligible`}
                />
              </div>
              <h4 className="ops-ov-subhead">Punctuality</h4>
              <div className="ops-ov-tiles">
                {(modules.campOne?.punctuality || []).map((row) => (
                  <KpiTile
                    key={`punct-${row.key}`}
                    to={row.href}
                    label={row.label}
                    qty={row.qty}
                    pctQty={row.pct}
                    showValue={false}
                  />
                ))}
              </div>
            </ModuleCard>

            <ModuleCard title="Master One" subtitle="New vs Existing HCWs">
              <div className="ops-ov-tiles">
                <KpiTile
                  to={modules.masterOne?.newHcws?.href}
                  label="New HCWs"
                  qty={modules.masterOne?.newHcws?.qty}
                  pctQty={modules.masterOne?.newHcws?.pct}
                  showValue={false}
                />
                <KpiTile
                  to={modules.masterOne?.existingHcws?.href}
                  label="Existing HCWs"
                  qty={modules.masterOne?.existingHcws?.qty}
                  pctQty={modules.masterOne?.existingHcws?.pct}
                  showValue={false}
                />
              </div>
            </ModuleCard>

            <ModuleCard title="Movement One" subtitle="All warehouses combined">
              <div className="ops-ov-tiles">
                <KpiTile
                  to={modules.movementOne?.inward?.href}
                  label="Inward"
                  qty={modules.movementOne?.inward?.qty}
                  value={modules.movementOne?.inward?.value}
                  showValue
                />
                <KpiTile
                  to={modules.movementOne?.outward?.href}
                  label="Outward"
                  qty={modules.movementOne?.outward?.qty}
                  value={modules.movementOne?.outward?.value}
                  showValue
                />
                <KpiTile
                  to={modules.movementOne?.closingBalance?.href}
                  label="Closing Balance"
                  qty={modules.movementOne?.closingBalance?.qty}
                  value={modules.movementOne?.closingBalance?.value}
                  showValue
                  meta={modules.movementOne?.closingBalance?.logic}
                />
              </div>
            </ModuleCard>

            <ModuleCard title="Finance One" subtitle="Client invoices · Expenses">
              <div className="ops-ov-tiles">
                <KpiTile
                  to={modules.financeOne?.revenue?.href}
                  label="Revenue"
                  qty={modules.financeOne?.revenue?.qty}
                  value={modules.financeOne?.revenue?.value}
                  showValue
                />
                <KpiTile
                  to={modules.financeOne?.outstanding?.href}
                  label="Outstanding"
                  qty={modules.financeOne?.outstanding?.qty}
                  value={modules.financeOne?.outstanding?.value}
                  showValue
                  meta={
                    modules.financeOne?.outstanding?.creditsApplied
                      ? `Credits ${formatInr(modules.financeOne.outstanding.creditsApplied)}`
                      : null
                  }
                />
                <KpiTile
                  to={modules.financeOne?.cost?.href}
                  label="Cost"
                  qty={modules.financeOne?.cost?.qty}
                  value={modules.financeOne?.cost?.value}
                  showValue
                />
              </div>
            </ModuleCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { campApi } from '../campOpsApi.js';
import {
  applyDefaultUsageToRows,
  emptyConsumableRow,
  isConsumableRowComplete,
  mergeConsumablesWithTemplate,
} from '../utils/campConsumables.js';

function ConsumableQtyInput({ value, onChange, disabled, ariaLabel }) {
  return (
    <input
      type="number"
      className="camp-consumables-qty-input"
      min="0"
      step="1"
      inputMode="numeric"
      value={value}
      onChange={onChange}
      onFocus={(e) => e.target.select()}
      disabled={disabled}
      placeholder="0"
      aria-label={ariaLabel}
    />
  );
}

function ConsumablesGrid({
  rows,
  disabled,
  mappedMode = false,
  onUpdateRow,
  onRemoveRow,
}) {
  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.excluded);

  return (
    <div className="camp-consumables-grid" role="table" aria-label="Consumables tracking">
      <div className="camp-consumables-grid-head" role="row">
        <span role="columnheader">Item</span>
        <span role="columnheader">Usage</span>
        <span role="columnheader">Wastage</span>
        {!disabled ? (
          <span className="camp-consumables-grid-actions-head" role="columnheader" aria-label="Actions" />
        ) : null}
      </div>

      {visible.map(({ row, index }) => {
        const rowComplete = isConsumableRowComplete(row);
        const itemLabel = row.itemName || 'Consumable';
        return (
          <div
            key={`consumable-${row.productId || index}`}
            className={`camp-consumables-grid-row ${!rowComplete ? 'is-incomplete' : ''}`}
            role="row"
          >
            <div className="camp-consumables-grid-item" role="cell">
              {mappedMode ? (
                <span className="camp-consumables-item-label" title={itemLabel}>
                  {itemLabel}
                </span>
              ) : (
                <ConsumableItemSelect
                  value={row.productId || ''}
                  onChange={(product) => onUpdateRow(index, {
                    productId: product?.id || '',
                    itemName: product?.name || '',
                    unit: product?.unit || '',
                    uomId: product?.uomId || '',
                  })}
                  disabled={disabled}
                />
              )}
            </div>
            <div className="camp-consumables-grid-qty" role="cell">
              <ConsumableQtyInput
                ariaLabel={`Usage for ${itemLabel}`}
                value={row.quantityUsed}
                onChange={(e) => onUpdateRow(index, {
                  quantityUsed: e.target.value,
                  usageManual: true,
                })}
                disabled={disabled}
              />
            </div>
            <div className="camp-consumables-grid-qty" role="cell">
              <ConsumableQtyInput
                ariaLabel={`Wastage for ${itemLabel}`}
                value={row.wastage ?? '0'}
                onChange={(e) => onUpdateRow(index, { wastage: e.target.value })}
                disabled={disabled}
              />
            </div>
            {!disabled ? (
              <div className="camp-consumables-grid-actions" role="cell">
                <button
                  type="button"
                  className="camp-consumables-used-remove-btn"
                  onClick={() => {
                    if (!window.confirm(`Do you want to remove ${itemLabel}?`)) return;
                    onRemoveRow(index);
                  }}
                  aria-label={`Remove ${itemLabel}`}
                  title={`Remove ${itemLabel}`}
                >
                  ×
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function CampConsumablesUsed({
  value = [],
  onChange,
  disabled = false,
  mappedItems = [],
  patientsScreened = '',
}) {
  const isMappedMode = Array.isArray(mappedItems) && mappedItems.length > 0;
  const rows = useMemo(
    () => mergeConsumablesWithTemplate(mappedItems, value, { patientsScreened }),
    [mappedItems, value, patientsScreened],
  );

  const prevPatientsRef = useRef(undefined);

  useEffect(() => {
    if (disabled || !onChange) return undefined;
    const prev = prevPatientsRef.current;
    prevPatientsRef.current = patientsScreened;
    if (prev === undefined || prev === patientsScreened) return undefined;

    const synced = applyDefaultUsageToRows(rows, patientsScreened);
    const changed = synced.some((row, index) => row.quantityUsed !== rows[index]?.quantityUsed);
    if (changed) onChange(synced);
    return undefined;
  }, [disabled, onChange, patientsScreened, rows]);

  function updateRow(index, patch) {
    onChange?.(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange?.([...rows, emptyConsumableRow()]);
  }

  function removeRow(index) {
    if (isMappedMode) {
      updateRow(index, { excluded: true });
      return;
    }
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange?.(next.length ? next : [emptyConsumableRow()]);
  }

  const activeCount = rows.filter((row) => !row.excluded).length;

  return (
    <section className="camp-consumables-used camp-consumables-panel">
      <div className="camp-consumables-used-header">
        <div>
          <h3>Consumables Tracking</h3>
          <p className="meta-text">
            {isMappedMode
              ? 'Usage defaults to Patients Screened. Add wastage and remove unused items.'
              : 'Select items from Consumables Master.'}
          </p>
        </div>
        {!disabled && !isMappedMode ? (
          <button type="button" className="btn secondary btn-sm" onClick={addRow}>
            Add row
          </button>
        ) : null}
      </div>

      {isMappedMode && !activeCount ? (
        <p className="meta-text">All mapped consumables removed.</p>
      ) : (
        <ConsumablesGrid
          rows={rows}
          disabled={disabled}
          mappedMode={isMappedMode}
          onUpdateRow={updateRow}
          onRemoveRow={removeRow}
        />
      )}
    </section>
  );
}

function ConsumableItemSelect({ value, onChange, disabled }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await campApi.consumableOptions();
        if (!active) return;
        setItems(res.data?.data || []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => {
        const product = items.find((item) => String(item.id) === String(e.target.value));
        onChange?.(product || null);
      }}
      disabled={disabled || loading}
    >
      <option value="">{loading ? 'Loading…' : 'Select item…'}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>{item.name}</option>
      ))}
    </select>
  );
}

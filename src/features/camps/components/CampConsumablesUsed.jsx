import { useEffect, useMemo, useState } from 'react';
import { campApi } from '../campOpsApi.js';
import {
  emptyConsumableRow,
  isConsumableRowComplete,
  mergeConsumablesWithTemplate,
} from '../utils/campConsumables.js';

function ConsumableQtyInput({ value, onChange, disabled, label, ariaLabel }) {
  return (
    <label className="camp-consumables-qty-field">
      <span className="sr-only">{label}</span>
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
    </label>
  );
}

function MappedConsumablesTable({ rows, disabled, onUpdateRow }) {
  return (
    <div className="camp-consumables-table-wrap">
      <table className="camp-consumables-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className="camp-consumables-table-qty">Usage</th>
            <th scope="col" className="camp-consumables-table-qty">Wastage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowComplete = isConsumableRowComplete(row);
            const itemLabel = row.itemName || 'Consumable';
            return (
              <tr
                key={`consumable-${row.productId || index}`}
                className={!rowComplete ? 'is-incomplete' : undefined}
              >
                <td className="camp-consumables-table-item">
                  <span className="camp-consumables-item-label" title={itemLabel}>
                    {itemLabel}
                  </span>
                </td>
                <td className="camp-consumables-table-qty">
                  <ConsumableQtyInput
                    label="Usage"
                    ariaLabel={`Usage for ${itemLabel}`}
                    value={row.quantityUsed}
                    onChange={(e) => onUpdateRow(index, { quantityUsed: e.target.value })}
                    disabled={disabled}
                  />
                </td>
                <td className="camp-consumables-table-qty">
                  <ConsumableQtyInput
                    label="Wastage"
                    ariaLabel={`Wastage for ${itemLabel}`}
                    value={row.wastage ?? ''}
                    onChange={(e) => onUpdateRow(index, { wastage: e.target.value })}
                    disabled={disabled}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CampConsumablesUsed({
  value = [],
  onChange,
  disabled = false,
  mappedItems = [],
}) {
  const isMappedMode = Array.isArray(mappedItems) && mappedItems.length > 0;
  const rows = useMemo(
    () => mergeConsumablesWithTemplate(mappedItems, value),
    [mappedItems, value],
  );

  function updateRow(index, patch) {
    onChange?.(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange?.([...rows, emptyConsumableRow()]);
  }

  function removeRow(index) {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange?.(next.length ? next : [emptyConsumableRow()]);
  }

  return (
    <section className="camp-consumables-used camp-consumables-panel">
      <div className="camp-consumables-used-header">
        <div>
          <h3>Consumables Tracking</h3>
          <p className="meta-text">
            {isMappedMode
              ? 'Enter usage and wastage for each mapped consumable.'
              : 'Select items from Consumables Master.'}
          </p>
        </div>
        {!disabled && !isMappedMode ? (
          <button type="button" className="btn secondary btn-sm" onClick={addRow}>
            Add row
          </button>
        ) : null}
      </div>

      {isMappedMode ? (
        <MappedConsumablesTable
          rows={rows}
          disabled={disabled}
          onUpdateRow={updateRow}
        />
      ) : (
      <div className="camp-consumables-grid" role="table" aria-label="Consumables tracking">
        <div className="camp-consumables-grid-head" role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Usage</span>
          <span role="columnheader">Wastage</span>
          {!disabled ? (
            <span className="camp-consumables-grid-actions-head" role="columnheader" aria-label="Actions" />
          ) : null}
        </div>

        {rows.map((row, index) => {
          const rowComplete = isConsumableRowComplete(row);
          return (
            <div
              key={`consumable-${row.productId || index}`}
              className={`camp-consumables-grid-row ${!rowComplete ? 'is-incomplete' : ''}`}
              role="row"
            >
              <div className="camp-consumables-grid-item" role="cell">
                <label>
                  <span className="sr-only">Item</span>
                  <ConsumableItemSelect
                    value={row.productId || ''}
                    onChange={(product) => updateRow(index, {
                      productId: product?.id || '',
                      itemName: product?.name || '',
                      unit: product?.unit || '',
                      uomId: product?.uomId || '',
                    })}
                    disabled={disabled}
                  />
                </label>
              </div>
              <div className="camp-consumables-grid-qty" role="cell">
                <ConsumableQtyInput
                  label="Usage"
                  ariaLabel={`Usage for row ${index + 1}`}
                  value={row.quantityUsed}
                  onChange={(e) => updateRow(index, { quantityUsed: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="camp-consumables-grid-qty" role="cell">
                <ConsumableQtyInput
                  label="Wastage"
                  ariaLabel={`Wastage for row ${index + 1}`}
                  value={row.wastage ?? ''}
                  onChange={(e) => updateRow(index, { wastage: e.target.value })}
                  disabled={disabled}
                />
              </div>
              {!disabled ? (
                <div className="camp-consumables-grid-actions" role="cell">
                  <button
                    type="button"
                    className="btn secondary btn-sm camp-consumables-used-remove-btn"
                    onClick={() => removeRow(index)}
                    aria-label={`Remove consumable row ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
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

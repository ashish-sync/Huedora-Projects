import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { FINANCE_BUILDER_OPTIONS, formatBuilderOptionLabel } from './financeBuilderRoutes.js';

/** Create-document type picker for Billing Center. */
export function FinanceBuilderCreateSelect() {
  const navigate = useNavigate();
  const options = useMemo(
    () =>
      [...FINANCE_BUILDER_OPTIONS].sort((a, b) =>
        formatBuilderOptionLabel(a).localeCompare(formatBuilderOptionLabel(b), undefined, {
          sensitivity: 'base',
        }),
      ),
    [],
  );
  const defaultValue = useMemo(() => {
    const invoice = options.find((item) => item.code === 'IN' && item.available);
    return invoice?.to || options.find((item) => item.available)?.to || '';
  }, [options]);
  const [value, setValue] = useState(defaultValue);
  const selected = options.find((item) => item.to === value);
  const canCreate = Boolean(selected?.available);

  const onCreate = () => {
    if (!selected?.available) return;
    navigate(selected.to);
  };

  return (
    <div className="finance-create-doc">
      <div className="finance-create-doc-row">
        <AdaptiveSelect
          id="finance-create-doc-type"
          className="finance-create-doc-select"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Document type"
        >
          {options.map((item) => (
            <option key={item.to} value={item.to} disabled={!item.available}>
              {formatBuilderOptionLabel(item)}
              {!item.available ? ' (coming soon)' : ''}
            </option>
          ))}
        </AdaptiveSelect>
        <button type="button" className="btn" disabled={!canCreate} onClick={onCreate}>
          Create
        </button>
      </div>
      {!canCreate && selected ? (
        <p className="finance-create-doc-hint muted">{selected.label} builder is coming soon.</p>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer FinanceBuilderCreateSelect */
export function FinanceBuilderTiles() {
  return <FinanceBuilderCreateSelect />;
}

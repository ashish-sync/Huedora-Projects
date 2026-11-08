import { useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import FieldError from '../../../components/ui/FieldError.jsx';
import { api } from '../../../shared/api.js';

/**
 * Attach a Form Master format to a Client Master program.
 * Prefer Public Camp Request formats for shareable camp request links.
 */
export function ProgramFormMasterSelect({
  value = '',
  formName = '',
  disabled = false,
  error = '',
  onChange,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    api('/forms?all=true&limit=200')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setRows(list);
        if (value) {
          const match = list.find((row) => String(row._id) === String(value));
          if (match?.name && match.name !== formName) {
            onChange?.({
              formMasterId: String(value),
              formMasterName: match.name,
            });
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message || 'Could not load form formats');
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Resolve linked form name once after load; ignore onChange identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    const active = rows.filter((row) => row.isActive !== false);
    const selected = rows.find((row) => String(row._id) === String(value));
    if (selected && selected.isActive === false && !active.some((row) => String(row._id) === String(value))) {
      return [...active, selected];
    }
    return active;
  }, [rows, value]);

  const selected = options.find((row) => String(row._id) === String(value));

  return (
    <label className="client-master-section-span-2">
      Request Form (Form Master)
      <AdaptiveSelect
        value={value || ''}
        disabled={disabled || loading}
        className={error ? 'input-invalid' : ''}
        onChange={(event) => {
          const nextId = event.target.value;
          const match = options.find((row) => String(row._id) === String(nextId));
          onChange?.({
            formMasterId: nextId,
            formMasterName: match?.name || '',
          });
        }}
        aria-label="Request form from Form Master"
      >
        <option value="">{loading ? 'Loading forms…' : 'Select a Form Master format…'}</option>
        {options.map((row) => (
          <option key={row._id} value={row._id}>
            {row.name}
            {row.code ? ` (${row.code})` : ''}
            {row.category === 'PUBLIC_CAMP_REQUEST' ? ' · Public Camp Request' : ''}
            {row.isActive === false ? ' · Inactive' : ''}
          </option>
        ))}
      </AdaptiveSelect>
      <p className="meta-text program-form-master-select__hint">
        {selected
          ? `${selected.fields?.length || 0} fields · Create or edit formats in Master One → Document One → Form Master.`
          : formName
            ? `Linked to “${formName}”. Create or edit formats in Master One → Document One → Form Master.`
            : 'Connect a Form Master format so this program’s camp request link uses that layout.'}
      </p>
      <FieldError message={error || loadError} />
    </label>
  );
}

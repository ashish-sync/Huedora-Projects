import { useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import FieldError from '../../../components/ui/FieldError.jsx';
import { api } from '../../../shared/api.js';

const PURPOSE = {
  request: {
    label: 'Request Form (Form Master) for Client',
    ariaLabel: 'Request form from Form Master for Client',
    preferredCategory: 'PUBLIC_CAMP_REQUEST',
    categorySuffix: ' · Public Camp Request',
    emptyHint: 'Connect a Form Master format for the Client camp request link.',
    linkedHint: (name) => `Linked to “${name}” for Client request. Edit formats in Master One → Document One → Form Master.`,
  },
  activity: {
    label: 'Activity Form (Form Master) for HCW',
    ariaLabel: 'Activity form from Form Master for HCW',
    preferredCategory: 'HCW_ACTIVITY',
    categorySuffix: ' · HCW Activity Form',
    emptyHint: 'Connect a Form Master format for the HCW Activity Form.',
    linkedHint: (name) => `Linked to “${name}” for HCW Activity. Edit formats in Master One → Document One → Form Master.`,
  },
};

/**
 * Attach a Form Master format to a Client Master program.
 * purpose=request → Client camp request form
 * purpose=activity → HCW Activity Form
 */
export function ProgramFormMasterSelect({
  purpose = 'request',
  value = '',
  formName = '',
  disabled = false,
  error = '',
  onChange,
}) {
  const config = PURPOSE[purpose] || PURPOSE.request;
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
        const raw = String(err?.message || '');
        const friendly = raw.includes('Route GET') || raw.includes('404')
          ? 'Could not load form formats'
          : (raw || 'Could not load form formats');
        setLoadError(friendly);
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
    const preferred = active.filter((row) => row.category === config.preferredCategory);
    const rest = active.filter((row) => row.category !== config.preferredCategory);
    const ordered = [...preferred, ...rest];
    const selected = rows.find((row) => String(row._id) === String(value));
    if (selected && selected.isActive === false && !ordered.some((row) => String(row._id) === String(value))) {
      return [...ordered, selected];
    }
    return ordered;
  }, [rows, value, config.preferredCategory]);

  const selected = options.find((row) => String(row._id) === String(value));

  return (
    <label className="client-master-section-span-2">
      {config.label}
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
        aria-label={config.ariaLabel}
      >
        <option value="">{loading ? 'Loading forms…' : 'Select a Form Master format…'}</option>
        {options.map((row) => (
          <option key={row._id} value={row._id}>
            {row.name}
            {row.code ? ` (${row.code})` : ''}
            {row.category === config.preferredCategory ? config.categorySuffix : ''}
            {row.category === 'PUBLIC_CAMP_REQUEST' && purpose !== 'request' ? ' · Public Camp Request' : ''}
            {row.category === 'HCW_ACTIVITY' && purpose !== 'activity' ? ' · HCW Activity Form' : ''}
            {row.isActive === false ? ' · Inactive' : ''}
          </option>
        ))}
      </AdaptiveSelect>
      <p className="meta-text program-form-master-select__hint">
        {selected
          ? `${selected.fields?.length || 0} fields · Create or edit formats in Master One → Document One → Form Master.`
          : formName
            ? config.linkedHint(formName)
            : config.emptyHint}
      </p>
      {error ? <FieldError message={error} /> : null}
      {!error && loadError && !rows.length ? (
        <span className="meta-text" style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 2 }}>
          {loadError}
        </span>
      ) : null}
    </label>
  );
}

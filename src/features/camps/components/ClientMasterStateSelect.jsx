import { useEffect, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { fetchGeoStates } from '../../../shared/geoApi.js';
import { gstStateCodeForName } from '../utils/indiaGstStateCodes.js';

export function ClientMasterStateSelect({
  stateName = '',
  stateCode = '',
  onChange,
  disabled = false,
  error = '',
}) {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGeoStates()
      .then((rows) => {
        if (!cancelled) setStates(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setStates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = states.find(
    (row) => String(row.name).toLowerCase() === String(stateName || '').trim().toLowerCase(),
  )?._id || '';

  return (
    <>
      <AdaptiveSelect
        value={selectedId}
        disabled={disabled || loading}
        threshold={8}
        onChange={(e) => {
          const id = e.target.value;
          const row = states.find((item) => String(item._id) === String(id));
          if (!row) {
            onChange?.({ stateName: '', stateCode: '' });
            return;
          }
          onChange?.({
            stateName: row.name,
            stateCode: gstStateCodeForName(row.name) || stateCode || '',
          });
        }}
      >
        <option value="">{loading ? 'Loading states…' : 'Select state'}</option>
        {states.map((row) => (
          <option key={row._id} value={row._id}>
            {row.name}
          </option>
        ))}
      </AdaptiveSelect>
      {error ? <small className="field-error">{error}</small> : null}
    </>
  );
}

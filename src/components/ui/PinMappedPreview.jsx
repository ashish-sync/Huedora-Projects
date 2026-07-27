import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';

export default function PinMappedPreview({ stateId, districtId, cityId, className = '' }) {
  const [preview, setPreview] = useState({ count: 0, label: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stateId && !districtId && !cityId) {
      setPreview({ count: 0, label: '' });
      return undefined;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    if (stateId) params.set('stateId', stateId);
    if (districtId) params.set('districtId', districtId);
    if (cityId) params.set('cityId', cityId);
    setLoading(true);
    api(`/geo/pin-codes/preview?${params}`)
      .then((r) => {
        if (!cancelled) setPreview(r.data || { count: 0, label: '' });
      })
      .catch(() => {
        if (!cancelled) setPreview({ count: 0, label: '' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateId, districtId, cityId]);

  if (!stateId && !districtId && !cityId) return null;

  return (
    <p className={`pin-mapped-preview muted ${className}`.trim()} role="status">
      {loading ? 'Loading PIN codes…' : (
        <>
          <strong>{preview.count}</strong> PIN{preview.count === 1 ? '' : 's'} mapped
          {preview.label ? <> · {preview.label}</> : null}
        </>
      )}
    </p>
  );
}

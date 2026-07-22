import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import AdaptiveSelect from './AdaptiveSelect.jsx';

const empty = {
  stateId: '',
  districtId: '',
  cityId: '',
  state: '',
  district: '',
  city: '',
  pinCode: '',
};

/**
 * Cascading India location controls backed by local /geo APIs (no external calls).
 * State → District → City; PIN from local pin-code master when available.
 */
export default function LocationCascade({
  value = empty,
  onChange,
  required = false,
  showDistrict = true,
  showCity = true,
  showPin = true,
  pinRequired = false,
  disabled = false,
  labels = {},
}) {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [cities, setCities] = useState([]);
  const [pins, setPins] = useState([]);
  const [error, setError] = useState('');

  const v = { ...empty, ...value };

  const emit = (patch) => {
    onChange?.({ ...v, ...patch });
  };

  useEffect(() => {
    api('/geo/states')
      .then((r) => setStates(r.data || []))
      .catch((e) => setError(e.message));
  }, []);

  // Resolve legacy free-text state/city names to master IDs when editing older rows
  useEffect(() => {
    if (!states.length || v.stateId || !v.state) return;
    const st = states.find((s) => String(s.name).toLowerCase() === String(v.state).toLowerCase());
    if (st) emit({ stateId: st._id, state: st.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydrate from name
  }, [states, v.state, v.stateId]);

  useEffect(() => {
    if (!districts.length || v.districtId || !v.district) return;
    const d = districts.find((x) => String(x.name).toLowerCase() === String(v.district).toLowerCase());
    if (d) emit({ districtId: d._id, district: d.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts, v.district, v.districtId]);

  useEffect(() => {
    if (!cities.length || v.cityId || !v.city) return;
    const c = cities.find((x) => String(x.name).toLowerCase() === String(v.city).toLowerCase());
    if (c) emit({ cityId: c._id, city: c.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, v.city, v.cityId]);

  useEffect(() => {
    if (!v.stateId) {
      setDistricts([]);
      setCities([]);
      setPins([]);
      return undefined;
    }
    let cancelled = false;
    api(`/geo/districts?stateId=${encodeURIComponent(v.stateId)}`)
      .then((r) => {
        if (!cancelled) setDistricts(r.data || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [v.stateId]);

  useEffect(() => {
    if (!v.stateId) {
      setCities([]);
      return undefined;
    }
    let cancelled = false;
    const params = new URLSearchParams({ stateId: v.stateId });
    if (v.districtId) params.set('districtId', v.districtId);
    api(`/geo/cities?${params}`)
      .then((r) => {
        if (!cancelled) setCities(r.data || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [v.stateId, v.districtId]);

  useEffect(() => {
    if (!showPin || !v.cityId) {
      setPins([]);
      return undefined;
    }
    let cancelled = false;
    api(`/geo/pin-codes?cityId=${encodeURIComponent(v.cityId)}&limit=100`)
      .then((r) => {
        if (!cancelled) setPins(r.data || []);
      })
      .catch(() => {
        if (!cancelled) setPins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [v.cityId, showPin]);

  const onState = (stateId) => {
    const st = states.find((s) => String(s._id) === String(stateId));
    emit({
      stateId: stateId || '',
      state: st?.name || '',
      districtId: '',
      district: '',
      cityId: '',
      city: '',
      pinCode: '',
    });
  };

  const onDistrict = (districtId) => {
    const d = districts.find((x) => String(x._id) === String(districtId));
    emit({
      districtId: districtId || '',
      district: d?.name || '',
      cityId: '',
      city: '',
      pinCode: '',
    });
  };

  const onCity = (cityId) => {
    const c = cities.find((x) => String(x._id) === String(cityId));
    emit({
      cityId: cityId || '',
      city: c?.name || '',
      pinCode: '',
      // keep district if city carries one
      districtId: c?.districtId || v.districtId || '',
      district:
        (c?.districtId && districts.find((d) => String(d._id) === String(c.districtId))?.name) ||
        v.district ||
        '',
    });
  };

  return (
    <div className="location-cascade">
      {error ? <p className="error-text">{error}</p> : null}
      <div className="field">
        <label>{labels.state || 'State'}{required ? ' *' : ''}</label>
        <AdaptiveSelect
          required={required}
          disabled={disabled}
          value={v.stateId}
          onChange={(e) => onState(e.target.value)}
          aria-label={labels.state || 'State'}
        >
          <option value="">Select state</option>
          {states.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </AdaptiveSelect>
      </div>

      {showDistrict ? (
        <div className="field">
          <label>{labels.district || 'District'}</label>
          <AdaptiveSelect
            disabled={disabled || !v.stateId}
            value={v.districtId}
            onChange={(e) => onDistrict(e.target.value)}
            aria-label={labels.district || 'District'}
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </AdaptiveSelect>
        </div>
      ) : null}

      {showCity ? (
        <div className="field">
          <label>{labels.city || 'City'}{required ? ' *' : ''}</label>
          <AdaptiveSelect
            required={required}
            disabled={disabled || !v.stateId}
            value={v.cityId}
            onChange={(e) => onCity(e.target.value)}
            aria-label={labels.city || 'City'}
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </AdaptiveSelect>
        </div>
      ) : null}

      {showPin ? (
        <div className="field">
          <label>{labels.pinCode || 'Pin code'}{pinRequired ? ' *' : ''}</label>
          {pins.length ? (
            <AdaptiveSelect
              required={pinRequired}
              disabled={disabled}
              value={v.pinCode}
              onChange={(e) => emit({ pinCode: e.target.value })}
              aria-label={labels.pinCode || 'Pin code'}
            >
              <option value="">Select or type below</option>
              {pins.map((p) => (
                <option key={p._id} value={p.pinCode}>
                  {p.pinCode}
                  {p.locality ? ` · ${p.locality}` : ''}
                </option>
              ))}
            </AdaptiveSelect>
          ) : null}
          <input
            required={pinRequired}
            disabled={disabled}
            inputMode="numeric"
            maxLength={6}
            placeholder={pins.length ? 'Or enter 6-digit PIN' : '6-digit PIN'}
            value={v.pinCode}
            onChange={(e) => emit({ pinCode: e.target.value.replace(/\D+/g, '').slice(0, 6) })}
            style={pins.length ? { marginTop: '0.5rem' } : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}

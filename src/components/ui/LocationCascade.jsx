import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { resolveZoneForState } from '../../constants/geoZones.js';
import AdaptiveSelect from './AdaptiveSelect.jsx';
import PinMappedPreview from './PinMappedPreview.jsx';

const empty = {
  stateId: '',
  districtId: '',
  cityId: '',
  state: '',
  district: '',
  city: '',
  zone: '',
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
  showZone = false,
  showPin = true,
  pinRequired = false,
  pinInputOnly = false,
  pinFirst = false,
  districtRequired = false,
  showMappedPinPreview = false,
  showPinCountsInOptions = false,
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
    api(`/geo/states${showPinCountsInOptions ? '?includePinStats=true' : ''}`)
      .then((r) => setStates(r.data || []))
      .catch((e) => setError(e.message));
  }, [showPinCountsInOptions]);

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
    api(`/geo/districts?stateId=${encodeURIComponent(v.stateId)}${showPinCountsInOptions ? '&includePinStats=true' : ''}`)
      .then((r) => {
        if (!cancelled) setDistricts(r.data || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [v.stateId, showPinCountsInOptions]);

  useEffect(() => {
    if (!v.stateId) {
      setCities([]);
      return undefined;
    }
    let cancelled = false;
    const params = new URLSearchParams({ stateId: v.stateId });
    if (v.districtId) params.set('districtId', v.districtId);
    if (showPinCountsInOptions) params.set('includePinStats', 'true');
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
  }, [v.stateId, v.districtId, showPinCountsInOptions]);

  useEffect(() => {
    if (!showPin || pinInputOnly || !v.cityId) {
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
  }, [v.cityId, showPin, pinInputOnly]);

  const onState = (stateId) => {
    const st = states.find((s) => String(s._id) === String(stateId));
    const stateName = st?.name || '';
    emit({
      stateId: stateId || '',
      state: stateName,
      districtId: '',
      district: '',
      cityId: '',
      city: '',
      pinCode: '',
      zone: stateName ? resolveZoneForState(stateName) : '',
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

  const optionSuffix = (item) =>
    showPinCountsInOptions && item.pinCount ? ` (${item.pinCount} PIN${item.pinCount === 1 ? '' : 's'})` : '';

  const pinPrereqMet = showCity ? v.cityId : v.districtId;

  const pinField = showPin ? (
    <div className="field" key="pin">
      <label>{labels.pinCode || 'PIN Code'}{pinRequired ? ' *' : ''}</label>
      {!pinInputOnly && pins.length ? (
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
        disabled={disabled || (pinInputOnly && !pinFirst && !pinPrereqMet)}
        inputMode="numeric"
        maxLength={6}
        placeholder={
          pinInputOnly
            ? pinFirst || pinPrereqMet
              ? 'Enter 6-digit PIN'
              : showCity
                ? 'Select city first'
                : 'Select district first'
            : pins.length
              ? 'Or enter 6-digit PIN'
              : '6-digit PIN'
        }
        value={v.pinCode}
        onChange={(e) => emit({ pinCode: e.target.value.replace(/\D+/g, '').slice(0, 6) })}
        style={!pinInputOnly && pins.length ? { marginTop: '0.5rem' } : undefined}
      />
    </div>
  ) : null;

  const stateField = (
    <div className="field" key="state">
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
              {optionSuffix(s)}
            </option>
          ))}
      </AdaptiveSelect>
    </div>
  );

  const districtField = showDistrict ? (
    <div className="field" key="district">
      <label>
        {labels.district || 'District'}
        {districtRequired ? ' *' : ''}
      </label>
      <AdaptiveSelect
        required={districtRequired}
        disabled={disabled || !v.stateId}
        value={v.districtId}
        onChange={(e) => onDistrict(e.target.value)}
        aria-label={labels.district || 'District'}
      >
        <option value="">{districtRequired ? 'Select district' : 'All districts'}</option>
        {districts.map((d) => (
          <option key={d._id} value={d._id}>
            {d.name}
            {optionSuffix(d)}
          </option>
        ))}
      </AdaptiveSelect>
    </div>
  ) : null;

  const zoneField = showZone ? (
    <div className="field" key="zone">
      <label>{labels.zone || 'Zone'}</label>
      <input
        disabled
        readOnly
        value={v.zone || (v.state ? resolveZoneForState(v.state) : '')}
        placeholder="Select state"
        aria-label={labels.zone || 'Zone'}
      />
    </div>
  ) : null;

  const cityField = showCity ? (
    <div className="field" key="city">
      <label>{labels.city || 'City'}{required ? ' *' : ''}</label>
      <AdaptiveSelect
        required={required}
        disabled={disabled || !v.stateId || (showDistrict && districtRequired && !v.districtId)}
        value={v.cityId}
        onChange={(e) => onCity(e.target.value)}
        aria-label={labels.city || 'City'}
      >
        <option value="">Select city</option>
        {cities.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
            {optionSuffix(c)}
          </option>
        ))}
      </AdaptiveSelect>
    </div>
  ) : null;

  const geoFields = showCity
    ? [stateField, zoneField, districtField, cityField].filter(Boolean)
    : [stateField, zoneField, districtField].filter(Boolean);

  const orderedFields = pinFirst ? [pinField, ...geoFields] : [...geoFields, pinField];

  return (
    <div className="location-cascade">
      {error ? <p className="error-text">{error}</p> : null}
      {orderedFields.filter(Boolean)}
      {showMappedPinPreview ? (
        <PinMappedPreview
          className="full"
          stateId={v.stateId}
          districtId={v.districtId}
          cityId={v.cityId}
        />
      ) : null}
    </div>
  );
}

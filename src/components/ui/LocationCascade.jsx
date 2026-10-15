import { useEffect, useRef, useState } from 'react';
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
  /** Optional field(s) rendered immediately after City (e.g. Camp Amount). */
  afterCity = null,
}) {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [cities, setCities] = useState([]);
  const [pins, setPins] = useState([]);
  const [error, setError] = useState('');
  const lastPinLookupRef = useRef('');

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
    const needle = String(v.city).toLowerCase();
    const c = cities.find((x) => String(x.name).toLowerCase() === needle)
      || (v.district
        ? cities.find((x) => String(x.name).toLowerCase() === String(v.district).toLowerCase())
        : null);
    if (c) emit({ cityId: c._id, city: c.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, v.city, v.cityId, v.district]);

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
    if (!showPin || pinInputOnly) {
      setPins([]);
      return undefined;
    }
    // Prefer city-scoped PINs; many master rows only have state/district — fall back.
    if (!v.cityId && !v.districtId && !v.stateId) {
      setPins([]);
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        if (v.cityId) {
          const byCity = await api(
            `/geo/pin-codes?cityId=${encodeURIComponent(v.cityId)}&limit=200`,
          );
          const cityPins = byCity.data || [];
          if (cityPins.length) {
            if (!cancelled) setPins(cityPins);
            return;
          }
        }
        if (v.districtId) {
          const byDistrict = await api(
            `/geo/pin-codes?districtId=${encodeURIComponent(v.districtId)}&limit=200`,
          );
          const districtPins = byDistrict.data || [];
          if (districtPins.length) {
            if (!cancelled) setPins(districtPins);
            return;
          }
        }
        if (v.stateId) {
          const byState = await api(
            `/geo/pin-codes?stateId=${encodeURIComponent(v.stateId)}&limit=200`,
          );
          if (!cancelled) setPins(byState.data || []);
          return;
        }
        if (!cancelled) setPins([]);
      } catch {
        if (!cancelled) setPins([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [v.cityId, v.districtId, v.stateId, showPin, pinInputOnly]);

  // When a full 6-digit PIN is entered, resolve State + City/District from Pin Code Master.
  useEffect(() => {
    if (!showPin) return undefined;
    const pin = String(v.pinCode || '').replace(/\D+/g, '');
    if (pin.length !== 6) {
      lastPinLookupRef.current = '';
      return undefined;
    }
    if (lastPinLookupRef.current === pin) return undefined;

    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/geo/pin-codes/lookup/${pin}`)
        .then((r) => {
          if (cancelled) return;
          lastPinLookupRef.current = pin;
          const resolved = r.resolved || (Array.isArray(r.data) && r.data[0]) || null;
          if (!resolved) {
            setError(`PIN ${pin} was not found in Pin Code Master`);
            return;
          }
          setError('');
          const stateName = resolved.stateName || resolved.state || '';
          const districtName = resolved.districtName || resolved.district || '';
          const cityName = resolved.cityName || resolved.city || '';
          // City/District follows Pin Geography district; cityName is already
          // district-corrected by the API when cityId is outside the PIN district.
          const mappedCity = cityName || districtName || '';
          emit({
            pinCode: pin,
            stateId: resolved.stateId || v.stateId || '',
            state: stateName || v.state || '',
            districtId: resolved.districtId || '',
            district: districtName,
            cityId: resolved.cityId || '',
            city: mappedCity,
            zone: resolved.zone || (stateName ? resolveZoneForState(stateName) : v.zone),
          });
        })
        .catch(() => {
          if (!cancelled) {
            lastPinLookupRef.current = pin;
            setError(`PIN ${pin} was not found in Pin Code Master`);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup once per PIN value
  }, [v.pinCode, showPin]);

  const onState = (stateId) => {
    const st = states.find((s) => String(s._id) === String(stateId));
    const stateName = st?.name || '';
    // When city UI is hidden (e.g. Service Provider), never clear persisted city —
    // there is no control to restore it after a state touch.
    const cityReset = showCity ? { cityId: '', city: '', pinCode: '' } : {};
    emit({
      stateId: stateId || '',
      state: stateName,
      districtId: '',
      district: '',
      ...cityReset,
      zone: stateName ? resolveZoneForState(stateName) : '',
    });
  };

  const onDistrict = (districtId) => {
    const d = districts.find((x) => String(x._id) === String(districtId));
    const cityReset = showCity ? { cityId: '', city: '', pinCode: '' } : {};
    emit({
      districtId: districtId || '',
      district: d?.name || '',
      ...cityReset,
    });
  };

  const onCity = (cityId) => {
    const c = cities.find((x) => String(x._id) === String(cityId));
    emit({
      cityId: cityId || '',
      city: c?.name || '',
      // PIN-first flows keep the typed PIN; cascade-style flows clear PIN when city changes.
      ...(pinFirst ? {} : { pinCode: '' }),
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

  const pinResolved = pinFirst
    && String(v.pinCode || '').replace(/\D+/g, '').length === 6
    && Boolean(v.stateId);
  const cityLabel = labels.city || 'City';
  const cityDisplay = v.city || v.district || '';
  const pinResolvedCity = pinResolved && Boolean(cityDisplay || v.cityId);
  const stateField = (
    <div className="field" key="state">
      <label>
        {labels.state || 'State'}
        {required ? ' *' : ''}
        {pinResolved ? ' (auto)' : ''}
      </label>
      <AdaptiveSelect
        required={required}
        disabled={disabled || pinResolved}
        value={v.stateId}
        onChange={(e) => onState(e.target.value)}
        aria-label={labels.state || 'State'}
      >
        <option value="">{pinResolved ? (v.state || 'State from PIN') : 'Select state'}</option>
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
      <label>
        {cityLabel}
        {required ? ' *' : ''}
        {pinResolvedCity ? ' (auto)' : ''}
      </label>
      {pinResolvedCity && !v.cityId ? (
        <input
          disabled
          readOnly
          value={cityDisplay}
          aria-label={cityLabel}
        />
      ) : (
        <AdaptiveSelect
          required={required}
          disabled={
            disabled
            || pinResolvedCity
            || !v.stateId
            || (showDistrict && districtRequired && !v.districtId)
          }
          value={v.cityId}
          onChange={(e) => onCity(e.target.value)}
          aria-label={cityLabel}
        >
          <option value="">
            {pinResolvedCity ? (cityDisplay || 'From PIN') : `Select ${cityLabel.toLowerCase()}`}
          </option>
          {cities.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
              {optionSuffix(c)}
            </option>
          ))}
        </AdaptiveSelect>
      )}
    </div>
  ) : null;

  const afterCityField = afterCity ? (
    <div className="field location-cascade-after-city" key="after-city">
      {afterCity}
    </div>
  ) : null;

  const geoFields = showCity
    ? [stateField, zoneField, districtField, cityField, afterCityField].filter(Boolean)
    : [stateField, zoneField, districtField].filter(Boolean);

  const orderedFields = pinFirst ? [pinField, ...geoFields] : [...geoFields, pinField];

  return (
    <div className={`location-cascade${error ? ' has-error' : ''}`}>
      {orderedFields.filter(Boolean)}
      {error ? <p className="error-text location-cascade-error">{error}</p> : null}
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

import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api.js';
import { resolveZoneForState } from '../../constants/geoZones.js';
import AdaptiveSelect from './AdaptiveSelect.jsx';

const empty = {
  pinCode: '',
  city: '',
  state: '',
  zone: '',
  cityId: '',
  stateId: '',
  districtId: '',
  district: '',
};

function enrichWithZone(loc) {
  const zone = loc.zone || (loc.state ? resolveZoneForState(loc.state) : '');
  return { ...loc, zone };
}

/**
 * PIN-first location control: enter 6-digit PIN → city, state, and zone auto-fill from master.
 */
export default function PinLocationLookup({
  value = empty,
  onChange,
  required = false,
  disabled = false,
  allowCreateMapping = false,
  labels = {},
}) {
  const v = { ...empty, ...value };
  const [lookupState, setLookupState] = useState('idle');
  const [lookupError, setLookupError] = useState('');
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const lastLookupPin = useRef('');

  const emit = (patch) => {
    onChange?.(enrichWithZone({ ...v, ...patch }));
  };

  useEffect(() => {
    if (!allowCreateMapping) return undefined;
    let cancelled = false;
    api('/geo/states')
      .then((r) => {
        if (!cancelled) setStates(r.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowCreateMapping]);

  useEffect(() => {
    if (!allowCreateMapping || !v.stateId) {
      setCities([]);
      return undefined;
    }
    let cancelled = false;
    api(`/geo/cities?stateId=${encodeURIComponent(v.stateId)}`)
      .then((r) => {
        if (!cancelled) setCities(r.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowCreateMapping, v.stateId]);

  useEffect(() => {
    const pin = String(v.pinCode || '').replace(/\D+/g, '');
    if (pin.length !== 6) {
      setLookupState('idle');
      setLookupError('');
      if (pin.length < 6) {
        lastLookupPin.current = '';
      }
      return undefined;
    }

    if (lastLookupPin.current === pin && v.city && v.state) {
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLookupState('loading');
      setLookupError('');
      api(`/geo/pin-codes/lookup/${pin}`)
        .then((r) => {
          if (cancelled) return;
          const resolved = r.resolved || (Array.isArray(r.data) && r.data.length ? r.data[0] : null);
          lastLookupPin.current = pin;
          if (!resolved) {
            setLookupState('not-found');
            if (!allowCreateMapping) {
              emit({
                city: '',
                state: '',
                zone: '',
                cityId: '',
                stateId: '',
                districtId: '',
                district: '',
              });
            }
            return;
          }
          setLookupState('found');
          emit({
            pinCode: pin,
            city: resolved.cityName || '',
            state: resolved.stateName || '',
            zone: resolved.zone || resolveZoneForState(resolved.stateName),
            cityId: resolved.cityId || '',
            stateId: resolved.stateId || '',
            districtId: resolved.districtId || '',
            district: resolved.districtName || '',
          });
        })
        .catch((e) => {
          if (cancelled) return;
          setLookupState('error');
          setLookupError(e.message);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup on PIN change only
  }, [v.pinCode, allowCreateMapping]);

  const onPinChange = (raw) => {
    const pinCode = String(raw).replace(/\D+/g, '').slice(0, 6);
    lastLookupPin.current = '';
    if (pinCode.length < 6) {
      emit({
        pinCode,
        city: '',
        state: '',
        zone: '',
        cityId: '',
        stateId: '',
        districtId: '',
        district: '',
      });
    } else {
      emit({ pinCode });
    }
  };

  const onStatePick = (stateId) => {
    const st = states.find((s) => String(s._id) === String(stateId));
    emit({
      stateId: stateId || '',
      state: st?.name || '',
      cityId: '',
      city: '',
      districtId: '',
      district: '',
      zone: st?.name ? resolveZoneForState(st.name) : '',
    });
  };

  const onCityPick = (cityId) => {
    const c = cities.find((x) => String(x._id) === String(cityId));
    emit({
      cityId: cityId || '',
      city: c?.name || '',
      districtId: c?.districtId || '',
    });
  };

  const showCreateMapping = allowCreateMapping && lookupState === 'not-found' && v.pinCode?.length === 6;

  return (
    <div className="pin-location-lookup location-cascade">
      <div className="field">
        <label>
          {labels.pinCode || 'PIN Code'}
          {required ? ' *' : ''}
        </label>
        <input
          required={required}
          disabled={disabled}
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit PIN"
          value={v.pinCode}
          onChange={(e) => onPinChange(e.target.value)}
        />
        {lookupState === 'loading' ? <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Looking up PIN…</p> : null}
        {lookupState === 'not-found' && !allowCreateMapping ? (
          <p className="error-text" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            PIN not found in master. Ask an admin to add this PIN.
          </p>
        ) : null}
        {lookupError ? <p className="error-text" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>{lookupError}</p> : null}
      </div>

      {showCreateMapping ? (
        <>
          <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
            This PIN is not in the master yet. Select city and state once to create the mapping (zone is derived from state).
          </p>
          <div className="field">
            <label>State *</label>
            <AdaptiveSelect required disabled={disabled} value={v.stateId} onChange={(e) => onStatePick(e.target.value)}>
              <option value="">Select state</option>
              {states.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </AdaptiveSelect>
          </div>
          <div className="field">
            <label>City *</label>
            <AdaptiveSelect
              required
              disabled={disabled || !v.stateId}
              value={v.cityId}
              onChange={(e) => onCityPick(e.target.value)}
            >
              <option value="">Select city</option>
              {cities.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </AdaptiveSelect>
          </div>
        </>
      ) : null}

      <div className="field">
        <label>{labels.city || 'City'}</label>
        <input readOnly className="input-readonly" value={v.city || ''} placeholder="Auto-filled from PIN" />
      </div>
      <div className="field">
        <label>{labels.state || 'State'}</label>
        <input readOnly className="input-readonly" value={v.state || ''} placeholder="Auto-filled from PIN" />
      </div>
      <div className="field">
        <label>{labels.zone || 'Zone'}</label>
        <input readOnly className="input-readonly" value={v.zone || ''} placeholder="Auto-filled from PIN" />
      </div>
    </div>
  );
}

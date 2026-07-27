import { useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api.js';
import { resolveZoneForState } from '../../../constants/geoZones.js';

/**
 * Editable camp location fields. PIN master lookup enriches state/district when a 6-digit PIN is entered.
 */
export default function CampLocationFields({
  value = {},
  onChange,
  disabled = false,
  required = false,
}) {
  const [pinLookup, setPinLookup] = useState('idle');
  const lastPinLookup = useRef('');

  const v = {
    city: '',
    state: '',
    district: '',
    pincode: '',
    zone: '',
    latitude: '',
    longitude: '',
    stateId: '',
    districtId: '',
    ...value,
  };

  const emit = (patch) => onChange?.({ ...v, ...patch });

  useEffect(() => {
    const pin = String(v.pincode || '').replace(/\D/g, '');
    if (pin.length !== 6) {
      setPinLookup('idle');
      if (pin.length < 6) lastPinLookup.current = '';
      return undefined;
    }
    if (lastPinLookup.current === pin && v.state && v.district) {
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setPinLookup('loading');
      api(`/geo/pin-codes/lookup/${pin}`)
        .then((r) => {
          if (cancelled) return;
          const resolved = r.resolved || (Array.isArray(r.data) && r.data.length ? r.data[0] : null);
          lastPinLookup.current = pin;
          if (!resolved) {
            setPinLookup('not-found');
            return;
          }
          setPinLookup('found');
          const state = resolved.stateName || v.state;
          emit({
            pincode: pin,
            state,
            district: resolved.districtName || v.district,
            zone: resolved.zone || resolveZoneForState(state) || v.zone,
            stateId: resolved.stateId || '',
            districtId: resolved.districtId || '',
            city: v.city || resolved.districtName || '',
          });
        })
        .catch(() => {
          if (!cancelled) setPinLookup('error');
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup when PIN changes
  }, [v.pincode]);

  const onStateChange = (state) => {
    emit({
      state,
      zone: resolveZoneForState(state) || v.zone,
    });
  };

  return (
    <div className="camp-location-fields location-cascade">
      <label className="field">
        City{required ? ' *' : ''}
        <input
          required={required}
          disabled={disabled}
          value={v.city}
          onChange={(e) => emit({ city: e.target.value })}
          placeholder="City"
        />
      </label>
      <label className="field">
        State{required ? ' *' : ''}
        <input
          required={required}
          disabled={disabled}
          value={v.state}
          onChange={(e) => onStateChange(e.target.value)}
          placeholder="State"
        />
      </label>
      <label className="field">
        Zone
        <input
          disabled={disabled}
          value={v.zone}
          onChange={(e) => emit({ zone: e.target.value })}
          placeholder="Zone"
        />
      </label>
      <label className="field">
        District
        <input
          disabled={disabled}
          value={v.district}
          onChange={(e) => emit({ district: e.target.value })}
          placeholder="District"
        />
      </label>
      <label className="field">
        PIN Code{required ? ' *' : ''}
        <input
          required={required}
          disabled={disabled}
          inputMode="numeric"
          maxLength={6}
          value={v.pincode}
          onChange={(e) => emit({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          placeholder="6-digit PIN"
        />
        {pinLookup === 'loading' ? (
          <span className="muted camp-location-fields-hint">Looking up PIN…</span>
        ) : null}
        {pinLookup === 'not-found' ? (
          <span className="muted camp-location-fields-hint">PIN not in master — fields kept as entered.</span>
        ) : null}
      </label>
      <label className="field">
        Latitude
        <input
          disabled={disabled}
          inputMode="decimal"
          value={v.latitude}
          onChange={(e) => emit({ latitude: e.target.value })}
          placeholder="e.g. 19.0760"
        />
      </label>
      <label className="field">
        Longitude
        <input
          disabled={disabled}
          inputMode="decimal"
          value={v.longitude}
          onChange={(e) => emit({ longitude: e.target.value })}
          placeholder="e.g. 72.8777"
        />
      </label>
    </div>
  );
}

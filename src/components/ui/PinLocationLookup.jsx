import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api.js';
import { resolveZoneForState } from '../../constants/geoZones.js';

const empty = {
  pinCode: '',
  state: '',
  zone: '',
  district: '',
  stateId: '',
  districtId: '',
};

function enrichWithZone(loc) {
  const zone = loc.zone || (loc.state ? resolveZoneForState(loc.state) : '');
  return { ...loc, zone };
}

/**
 * PIN-first location control: enter 6-digit PIN → state, zone, and district auto-fill from master.
 */
export default function PinLocationLookup({
  value = empty,
  onChange,
  required = false,
  disabled = false,
  labels = {},
}) {
  const v = { ...empty, ...value };
  const [lookupState, setLookupState] = useState('idle');
  const [lookupError, setLookupError] = useState('');
  const lastLookupPin = useRef('');

  const emit = (patch) => {
    onChange?.(enrichWithZone({ ...v, ...patch }));
  };

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

    if (lastLookupPin.current === pin && v.state && v.district) {
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
            emit({
              state: '',
              zone: '',
              district: '',
              stateId: '',
              districtId: '',
            });
            return;
          }
          setLookupState('found');
          emit({
            pinCode: pin,
            state: resolved.stateName || '',
            district: resolved.districtName || '',
            zone: resolved.zone || resolveZoneForState(resolved.stateName),
            stateId: resolved.stateId || '',
            districtId: resolved.districtId || '',
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
  }, [v.pinCode]);

  const onPinChange = (raw) => {
    const pinCode = String(raw).replace(/\D+/g, '').slice(0, 6);
    lastLookupPin.current = '';
    if (pinCode.length < 6) {
      emit({
        pinCode,
        state: '',
        zone: '',
        district: '',
        stateId: '',
        districtId: '',
      });
    } else {
      emit({ pinCode });
    }
  };

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
        {lookupState === 'loading' ? (
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            Looking up PIN…
          </p>
        ) : null}
        {lookupState === 'not-found' ? (
          <p className="error-text" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            PIN not found in master. Ask an admin to add this PIN in PIN Geography.
          </p>
        ) : null}
        {lookupError ? (
          <p className="error-text" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            {lookupError}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label>{labels.state || 'State'}</label>
        <input readOnly className="input-readonly" value={v.state || ''} placeholder="Auto-filled from PIN" />
      </div>
      <div className="field">
        <label>{labels.zone || 'Zone'}</label>
        <input readOnly className="input-readonly" value={v.zone || ''} placeholder="Auto-filled from PIN" />
      </div>
      <div className="field">
        <label>{labels.district || 'District'}</label>
        <input readOnly className="input-readonly" value={v.district || ''} placeholder="Auto-filled from PIN" />
      </div>
    </div>
  );
}

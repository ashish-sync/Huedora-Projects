import { useEffect, useState } from 'react';
import PinLocationLookup from '../../../components/ui/PinLocationLookup.jsx';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { fetchGeoStates, fetchGeoDistricts, fetchGeoCities } from '../../../shared/geoApi.js';

/**
 * True when PIN lookup / cascade moved to a different place and city should reset.
 * Filling missing stateId/districtId for the same place must NOT clear city
 * (stage remount + PIN re-lookup used to wipe city and fail "City is required").
 */
export function shouldClearCityOnLocationChange(prev = {}, next = {}) {
  const prevStateId = String(prev.stateId || '').trim();
  const prevDistrictId = String(prev.districtId || '').trim();
  const nextStateId = String(next.stateId || '').trim();
  const nextDistrictId = String(next.districtId || '').trim();

  const stateSwitched = Boolean(prevStateId && nextStateId && prevStateId !== nextStateId);
  const districtSwitched = Boolean(prevDistrictId && nextDistrictId && prevDistrictId !== nextDistrictId);
  const locationCleared = !nextStateId && !nextDistrictId && Boolean(
    prevStateId || prevDistrictId || String(prev.city || '').trim() || String(prev.cityId || '').trim(),
  );

  return stateSwitched || districtSwitched || locationCleared;
}

/**
 * Camp location: PIN master drives state / zone / district; city is chosen from the state-wise city master.
 */
export default function CampLocationFields({
  value = {},
  onChange,
  disabled = false,
  required = false,
}) {
  const v = {
    city: '',
    cityId: '',
    state: '',
    district: '',
    pincode: '',
    zone: '',
    stateId: '',
    districtId: '',
    ...value,
  };

  const [cities, setCities] = useState([]);
  const [cityError, setCityError] = useState('');

  const emit = (patch) => onChange?.({ ...v, ...patch });

  useEffect(() => {
    if (v.stateId || !v.state) return undefined;

    let cancelled = false;
    fetchGeoStates()
      .then((states) => {
        if (cancelled) return;
        const state = (states || []).find(
          (item) => String(item.name).toLowerCase() === String(v.state).toLowerCase(),
        );
        if (state) emit({ stateId: state._id, state: state.name });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate legacy state names once
  }, [v.state, v.stateId]);

  useEffect(() => {
    if (v.districtId || !v.stateId || !v.district) return undefined;

    let cancelled = false;
    fetchGeoDistricts(v.stateId)
      .then((districts) => {
        if (cancelled) return;
        const district = (districts || []).find(
          (item) => String(item.name).toLowerCase() === String(v.district).toLowerCase(),
        );
        if (district) emit({ districtId: district._id, district: district.name });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate legacy district names once
  }, [v.district, v.districtId, v.stateId]);

  useEffect(() => {
    if (!v.stateId) {
      setCities([]);
      setCityError('');
      return undefined;
    }

    let cancelled = false;
    fetchGeoCities(v.stateId)
      .then((rows) => {
        if (!cancelled) {
          setCities(rows || []);
          setCityError('');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCities([]);
          setCityError(e.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [v.stateId]);

  useEffect(() => {
    if (!cities.length || v.cityId || !v.city) return;
    const match = cities.find(
      (city) => String(city.name).toLowerCase() === String(v.city).toLowerCase(),
    );
    if (match) emit({ cityId: match._id, city: match.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate legacy city names once
  }, [cities, v.city, v.cityId]);

  const onCity = (cityId) => {
    const city = cities.find((item) => String(item._id) === String(cityId));
    emit({
      cityId: cityId || '',
      city: city?.name || '',
    });
  };

  return (
    <div className="camp-location-fields location-cascade">
      <PinLocationLookup
        required={required}
        disabled={disabled}
        value={{
          pinCode: v.pincode,
          state: v.state,
          zone: v.zone,
          district: v.district,
          stateId: v.stateId,
          districtId: v.districtId,
        }}
        onChange={(loc) => {
          const nextLoc = {
            pincode: loc.pinCode,
            state: loc.state,
            zone: loc.zone,
            district: loc.district,
            stateId: loc.stateId,
            districtId: loc.districtId,
          };
          const clearCity = shouldClearCityOnLocationChange(v, nextLoc);
          emit({
            ...nextLoc,
            ...(clearCity ? { city: '', cityId: '' } : {}),
          });
        }}
        labels={{
          pinCode: 'PIN Code',
          state: 'State',
          zone: 'Zone',
          district: 'District',
        }}
      />
      <label className="field">
        City{required ? ' *' : ''}
        <AdaptiveSelect
          className="tylo-select"
          threshold={8}
          required={required}
          disabled={disabled || !v.stateId}
          value={v.cityId}
          onChange={(e) => onCity(e.target.value)}
          aria-label="City"
          placeholder={v.stateId ? 'Select city' : 'Enter PIN first'}
        >
          <option value="">{v.stateId ? 'Select city' : 'Enter PIN first'}</option>
          {cities.map((city) => (
            <option key={city._id} value={city._id}>
              {city.name}
            </option>
          ))}
        </AdaptiveSelect>
        {cityError ? <p className="error-text">{cityError}</p> : null}
      </label>
    </div>
  );
}

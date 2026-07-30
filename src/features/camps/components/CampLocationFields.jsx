import { useEffect, useState } from 'react';
import PinLocationLookup from '../../../components/ui/PinLocationLookup.jsx';
import { api } from '../../../shared/api.js';

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
    api('/geo/states')
      .then((r) => {
        if (cancelled) return;
        const state = (r.data || []).find(
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
    api(`/geo/districts?stateId=${encodeURIComponent(v.stateId)}`)
      .then((r) => {
        if (cancelled) return;
        const district = (r.data || []).find(
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
    const params = new URLSearchParams({ stateId: v.stateId });

    api(`/geo/cities?${params}`)
      .then((r) => {
        if (!cancelled) {
          setCities(r.data || []);
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
          const locationChanged = loc.stateId !== v.stateId || loc.districtId !== v.districtId;
          emit({
            pincode: loc.pinCode,
            state: loc.state,
            zone: loc.zone,
            district: loc.district,
            stateId: loc.stateId,
            districtId: loc.districtId,
            ...(locationChanged ? { city: '', cityId: '' } : {}),
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
        <select
          required={required}
          disabled={disabled || !v.stateId}
          value={v.cityId}
          onChange={(e) => onCity(e.target.value)}
          aria-label="City"
        >
          <option value="">{v.stateId ? 'Select city' : 'Enter PIN first'}</option>
          {cities.map((city) => (
            <option key={city._id} value={city._id}>
              {city.name}
            </option>
          ))}
        </select>
        {cityError ? <p className="error-text">{cityError}</p> : null}
      </label>
    </div>
  );
}

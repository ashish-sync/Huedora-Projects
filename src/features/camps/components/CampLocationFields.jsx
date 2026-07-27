import PinLocationLookup from '../../../components/ui/PinLocationLookup.jsx';

/**
 * Camp location: PIN master drives state / zone / district; city stays editable.
 */
export default function CampLocationFields({
  value = {},
  onChange,
  disabled = false,
  required = false,
}) {
  const v = {
    city: '',
    state: '',
    district: '',
    pincode: '',
    zone: '',
    stateId: '',
    districtId: '',
    ...value,
  };

  const emit = (patch) => onChange?.({ ...v, ...patch });

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
          emit({
            pincode: loc.pinCode,
            state: loc.state,
            zone: loc.zone,
            district: loc.district,
            stateId: loc.stateId,
            districtId: loc.districtId,
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
        City
        <input
          disabled={disabled}
          value={v.city}
          onChange={(e) => emit({ city: e.target.value })}
          placeholder="City / locality"
        />
      </label>
    </div>
  );
}

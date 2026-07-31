/**
 * Camp / clinic address — plain text entry (no map preview or Places autocomplete).
 */
export default function CampAddressField({
  value = {},
  onChange,
  disabled = false,
  required = false,
}) {
  const address = value.campAddress || '';

  return (
    <input
      className="camp-address-input"
      value={address}
      onChange={(e) => onChange?.({
        campAddress: e.target.value,
        addressManualEntry: true,
        googlePlaceId: '',
        latitude: '',
        longitude: '',
      })}
      placeholder="Enter camp / clinic address"
      required={required}
      disabled={disabled}
      autoComplete="off"
      data-form-type="other"
    />
  );
}

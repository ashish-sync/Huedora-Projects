/**
 * Camp / clinic address — plain text by default.
 * Public Camp Request Form can pass `lookup` to enable server-side Ola autocomplete.
 */
import { bindAutofillBlock } from '../../../shared/suppressBrowserAutofill.js';
import PublicOlaAddressAutocomplete from '../requestForm/PublicOlaAddressAutocomplete.jsx';

export default function CampAddressField({
  value = {},
  onChange,
  disabled = false,
  required = false,
  lookup = null,
}) {
  const address = value.campAddress || '';

  if (lookup?.autocomplete) {
    return (
      <PublicOlaAddressAutocomplete
        value={address}
        selectedPlaceId={value.googlePlaceId || ''}
        lookup={lookup}
        onChange={onChange}
        disabled={disabled}
        required={required}
      />
    );
  }

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
      {...bindAutofillBlock()}
    />
  );
}

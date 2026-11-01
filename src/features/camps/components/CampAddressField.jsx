/**
 * Camp / clinic address — plain text by default.
 * Public Camp Request Form, Create Camp, and Contact Directory can pass `lookup`
 * to enable the shared server-side Ola autocomplete.
 */
import { bindAutofillBlock } from '../../../shared/suppressBrowserAutofill.js';
import PublicOlaAddressAutocomplete from '../requestForm/PublicOlaAddressAutocomplete.jsx';

export default function CampAddressField({
  value = {},
  onChange,
  disabled = false,
  required = false,
  lookup = null,
  placeholder,
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
        placeholder={placeholder || 'Search or type camp / clinic address'}
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
      placeholder={placeholder || 'Enter camp / clinic address'}
      required={required}
      disabled={disabled}
      {...bindAutofillBlock()}
    />
  );
}

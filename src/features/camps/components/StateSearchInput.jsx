import { SearchableOptionsInput } from './SearchableOptionsInput';
import { INDIAN_STATES } from '../constants/indianStates';

export function StateSearchInput({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search or select state',
}) {
  return (
    <SearchableOptionsInput
      id={id}
      value={value}
      onChange={onChange}
      options={INDIAN_STATES}
      disabled={disabled}
      placeholder={placeholder}
      groupLabel="States & Union Territories"
      emptyMessage="No matching states. You can keep your typed value."
      maxResults={INDIAN_STATES.length}
    />
  );
}

import { useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from './AdaptiveSelect.jsx';
import { submitPicklistSuggestion } from '../../shared/usePicklistOptions.js';

function isOtherSentinel(value, otherLabel) {
  const n = String(value || '')
    .trim()
    .toLowerCase();
  const o = String(otherLabel || 'Other')
    .trim()
    .toLowerCase();
  return n === o || n === 'other' || n === 'others';
}

/**
 * Select that shows a text box when "Other" / "Others" is chosen.
 * Custom text is emitted as the field value and submitted for Master One approval.
 *
 * Props:
 * - options: string[] (should include Other sentinel; it is ensured)
 * - value / onChange: native-like { target: { value } }
 * - picklistKey: registry key for suggestion API
 * - otherLabel: default "Other"
 * - source: optional context string for audit
 */
export default function OtherAwareSelect({
  options = [],
  value = '',
  onChange,
  picklistKey,
  otherLabel = 'Other',
  source = '',
  disabled = false,
  required = false,
  name,
  id,
  className = '',
  placeholder = 'Select…',
  threshold = 10,
}) {
  const known = useMemo(() => {
    const list = (options || []).map((o) => String(o).trim()).filter(Boolean);
    const hasOther = list.some((o) => isOtherSentinel(o, otherLabel));
    return hasOther ? list : [...list, otherLabel];
  }, [options, otherLabel]);

  const knownWithoutOther = useMemo(
    () => known.filter((o) => !isOtherSentinel(o, otherLabel)),
    [known, otherLabel]
  );

  const valueStr = String(value ?? '').trim();
  const isKnownExact = knownWithoutOther.some((o) => o === valueStr);
  const isCustom = Boolean(valueStr) && !isKnownExact && !isOtherSentinel(valueStr, otherLabel);

  const [otherMode, setOtherMode] = useState(isCustom || isOtherSentinel(valueStr, otherLabel));
  const [otherText, setOtherText] = useState(isCustom ? valueStr : '');
  const [hint, setHint] = useState('');
  const [suggestError, setSuggestError] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);

  useEffect(() => {
    if (isCustom) {
      setOtherMode(true);
      setOtherText(valueStr);
    } else if (isOtherSentinel(valueStr, otherLabel)) {
      setOtherMode(true);
    } else if (isKnownExact) {
      setOtherMode(false);
      setOtherText('');
      setHint('');
      setSuggestError('');
    } else if (!valueStr) {
      setOtherMode(false);
      setOtherText('');
    }
  }, [valueStr, isCustom, isKnownExact, otherLabel]);

  const selectValue = otherMode ? otherLabel : valueStr;

  const emit = (next) => {
    onChange?.({ target: { value: next, name } });
  };

  const onSelectChange = (e) => {
    const next = e.target.value;
    if (isOtherSentinel(next, otherLabel)) {
      setOtherMode(true);
      setOtherText('');
      setHint('');
      setSuggestError('');
      emit('');
      return;
    }
    setOtherMode(false);
    setOtherText('');
    setHint('');
    setSuggestError('');
    emit(next);
  };

  const commitOtherText = async (raw) => {
    const trimmed = String(raw || '').trim();
    setOtherText(trimmed);
    emit(trimmed);
    if (!trimmed || !picklistKey) return;

    // If it matches an existing option, don't suggest
    if (knownWithoutOther.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
      setHint('');
      setSuggestError('');
      return;
    }

    setSuggestBusy(true);
    setSuggestError('');
    try {
      await submitPicklistSuggestion(picklistKey, trimmed, source);
      setHint('Submitted for approval — will appear in the dropdown after approval');
    } catch (err) {
      const msg = err?.message || 'Could not submit for approval';
      // Duplicate is OK if already pending/approved — still keep the value on the form
      if (/already/i.test(msg)) {
        setHint(msg);
        setSuggestError('');
      } else {
        setSuggestError(msg);
        setHint('');
      }
    } finally {
      setSuggestBusy(false);
    }
  };

  return (
    <div className={`other-aware-select ${className}`.trim()}>
      <AdaptiveSelect
        id={id}
        name={name}
        threshold={threshold}
        value={selectValue}
        onChange={onSelectChange}
        disabled={disabled}
        required={required && !otherMode}
        className="other-aware-select__control"
        style={{ width: '100%' }}
      >
        <option value="">{placeholder}</option>
        {known.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </AdaptiveSelect>

      {otherMode && (
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label htmlFor={id ? `${id}-other` : undefined}>Specify {otherLabel.toLowerCase()} *</label>
          <input
            id={id ? `${id}-other` : undefined}
            type="text"
            value={otherText}
            disabled={disabled}
            required={required}
            placeholder="Enter new value"
            onChange={(e) => {
              setOtherText(e.target.value);
              emit(e.target.value);
            }}
            onBlur={() => commitOtherText(otherText)}
          />
          {suggestBusy && <p className="muted mono-sm">Submitting for approval…</p>}
          {hint && !suggestError && <p className="muted mono-sm">{hint}</p>}
          {suggestError && <p className="error mono-sm">{suggestError}</p>}
        </div>
      )}
    </div>
  );
}

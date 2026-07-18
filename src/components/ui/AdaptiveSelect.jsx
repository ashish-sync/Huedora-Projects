import { Children, isValidElement } from 'react';
import Select from 'react-select';

function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) return textContent(node.props.children);
  return '';
}

function optionChildren(children) {
  return Children.toArray(children).filter(
    (child) => isValidElement(child) && child.type === 'option'
  );
}

export default function AdaptiveSelect({
  children,
  threshold = 10,
  value,
  onChange,
  multiple = false,
  disabled = false,
  required = false,
  name,
  id,
  className = '',
  style,
  placeholder,
  'aria-label': ariaLabelProp,
  ...rest
}) {
  const childOptions = optionChildren(children);
  const parsedOptions = childOptions.map((child) => ({
    value: child.props.value == null ? '' : String(child.props.value),
    label: textContent(child.props.children),
    isDisabled: Boolean(child.props.disabled),
  }));
  const emptyOption = parsedOptions.find((option) => option.value === '');
  const choices = parsedOptions.filter((option) => option.value !== '');
  const ariaLabel =
    ariaLabelProp || placeholder || emptyOption?.label || name || 'Select option';

  if (choices.length < threshold) {
    return (
      <select
        {...rest}
        id={id}
        name={name}
        aria-label={ariaLabel}
        className={className}
        style={style}
        value={value}
        onChange={onChange}
        multiple={multiple}
        disabled={disabled}
        required={required}
      >
        {children}
      </select>
    );
  }

  const selected = multiple
    ? choices.filter((option) =>
        (Array.isArray(value) ? value : []).some(
          (selectedValue) => String(selectedValue) === option.value
        )
      )
    : choices.find((option) => String(value ?? '') === option.value) || null;

  const emitChange = (nextSelection) => {
    const selectedOptions = multiple
      ? (nextSelection || []).map((option) => ({ value: option.value, label: option.label }))
      : [];
    const nextValue = multiple
      ? selectedOptions.map((option) => option.value)
      : nextSelection?.value || '';
    onChange?.({
      target: {
        value: nextValue,
        name,
        selectedOptions,
      },
      currentTarget: {
        value: nextValue,
        name,
        selectedOptions,
      },
    });
  };

  return (
    <Select
      {...rest}
      inputId={id}
      name={name}
      aria-label={ariaLabel}
      className={`adaptive-select${multiple ? ' adaptive-select--multi' : ''}${
        className ? ` ${className}` : ''
      }`}
      classNamePrefix="adaptive-select"
      styles={
        style
          ? {
              container: (base) => ({ ...base, ...style }),
              control: (base) => ({
                ...base,
                ...(style.height ? { minHeight: style.height } : {}),
                ...(style.minHeight ? { minHeight: style.minHeight } : {}),
              }),
            }
          : undefined
      }
      options={choices}
      value={selected}
      onChange={emitChange}
      isMulti={multiple}
      isDisabled={disabled}
      isClearable={Boolean(emptyOption) && !required}
      isSearchable
      required={required}
      placeholder={placeholder || emptyOption?.label || 'Select…'}
      noOptionsMessage={({ inputValue }) =>
        inputValue ? 'No matching options' : 'No options available'
      }
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
    />
  );
}

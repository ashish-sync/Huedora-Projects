import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PhoneField } from './PhoneField.jsx';

afterEach(cleanup);

function ControlledPhoneField(props) {
  const [value, setValue] = useState(props.initialValue || '');
  return (
    <PhoneField
      label="SPOC Number"
      value={value}
      onChange={setValue}
      {...props}
    />
  );
}

describe('PhoneField', () => {
  it('normalizes input to digits only and caps at 10 characters', async () => {
    const user = userEvent.setup();

    render(<ControlledPhoneField />);

    const input = screen.getByLabelText('SPOC Number');
    await user.type(input, '98ab765-43210extra');

    expect(input.value).toBe('9876543210');
  });

  it('shows validation errors from the parent form', () => {
    render(
      <PhoneField
        label="Contact"
        value="123"
        onChange={() => {}}
        error="Mobile number must be exactly 10 digits"
      />,
    );

    expect(screen.getByText('Mobile number must be exactly 10 digits')).toBeTruthy();
    const input = screen.getByDisplayValue('123');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});

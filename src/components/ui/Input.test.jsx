import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Input from './Input.jsx';

describe('Input Primitive', () => {
  it('renders input with label and hint', () => {
    render(<Input label="Device Serial Number" hint="Located on the rear barcode" />);
    expect(screen.getByLabelText('Device Serial Number')).toBeTruthy();
    expect(screen.getByText('Located on the rear barcode')).toBeTruthy();
  });

  it('renders required indicator when required prop is passed', () => {
    render(<Input label="Full Name" required />);
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('renders error message and aria-invalid on validation failure', () => {
    render(<Input label="Email Address" error="Valid email format is required" />);
    const input = screen.getByLabelText('Email Address');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Valid email format is required');
  });
});

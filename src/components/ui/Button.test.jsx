import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button.jsx';

describe('Button Primitive', () => {
  it('renders primary button with children and standard classes', () => {
    render(<Button>Submit Record</Button>);
    const btn = screen.getByRole('button', { name: 'Submit Record' });
    expect(btn).toBeTruthy();
    expect(btn.className).toContain('btn');
  });

  it('renders secondary variant and compact size', () => {
    render(
      <Button variant="secondary" size="compact">
        Cancel Action
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Cancel Action' });
    expect(btn.className).toContain('secondary');
    expect(btn.className).toContain('btn-compact');
  });

  it('handles loading state with spinner and disabled lock', () => {
    render(
      <Button loading loadingText="Saving...">
        Save Record
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Saving...' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.className).toContain('is-loading');
  });

  it('prevents double-clicks during async onClick handlers', async () => {
    const user = userEvent.setup();
    let resolvePromise;
    const asyncAction = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    render(<Button onClick={asyncAction}>Async Submit</Button>);
    const btn = screen.getByRole('button', { name: 'Async Submit' });

    // Click twice rapidly
    await user.click(btn);
    await user.click(btn);

    // Only one execution triggered because inFlightRef locked the second click
    expect(asyncAction).toHaveBeenCalledTimes(1);

    // Settle promise
    resolvePromise();
  });

  it('requires title or aria-label for icon-only accessibility', () => {
    render(
      <Button icon={<span>🔍</span>} title="Search records" />
    );
    const btn = screen.getByRole('button', { name: 'Search records' });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('title')).toBe('Search records');
  });
});

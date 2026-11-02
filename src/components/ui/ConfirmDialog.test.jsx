import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog.jsx';

describe('ConfirmDialog Primitive', () => {
  it('does not render when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete Record"
        message="Are you sure you want to delete this record?"
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title, message, and action buttons when open', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Record"
        message="Are you sure you want to delete this record?"
        confirmLabel="Yes, Delete"
        cancelLabel="Keep Record"
      />
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Delete Record' })).toBeTruthy();
    expect(
      screen.getByText('Are you sure you want to delete this record?')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep Record' })).toBeTruthy();
  });

  it('triggers onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        title="Approve Camp"
        confirmLabel="Approve"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('triggers onCancel when cancel button clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        title="Reject Item"
        cancelLabel="Go Back"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Go Back' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});


import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import InvoiceBuilderShell from './InvoiceBuilderShell.jsx';

vi.mock('../../../shared/auth.jsx', () => ({
  useAuth: () => ({
    user: { role: 'admin' },
    can: () => true,
    isAdmin: () => true,
  }),
}));

vi.mock('../../notifications/WatchFollowButton.jsx', () => ({
  default: () => null,
}));

vi.mock('./CorrectDocumentNumberModal.jsx', () => ({
  default: () => null,
}));

vi.mock('../documentGenerator/usePreviewScale.js', () => ({
  usePreviewScale: () => ({
    wrapRef: { current: null },
    scale: 1,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: vi.fn(),
    fitToWidth: vi.fn(),
    pagePx: { w: 100, h: 100 },
  }),
}));

function renderShell(overrides = {}) {
  const onCancel = vi.fn();
  render(
    <MemoryRouter>
      <InvoiceBuilderShell
        docTypeLabel="Tax Invoice"
        docNumber="TCIN2600001"
        status="Issued"
        docId="doc-1"
        panelOpen={false}
        onTogglePanel={vi.fn()}
        onCancel={onCancel}
        shortcutsOpen={false}
        onShortcutsClose={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { onCancel };
}

describe('InvoiceBuilderShell cancel warning', () => {
  afterEach(() => {
    cleanup();
  });

  it('asks before cancelling and does nothing when the user says No', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderShell();

    await user.click(screen.getByTitle('Cancel document'));
    expect(screen.getByText('Do you want to cancel this?')).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByText('Do you want to cancel this?')).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels the document when the user says Yes', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderShell();

    await user.click(screen.getByTitle('Cancel document'));
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

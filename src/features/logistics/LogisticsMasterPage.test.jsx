import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LogisticsMasterPage from './LogisticsMasterPage.jsx';

const api = vi.fn();

vi.mock('../../shared/api.js', () => ({
  api: (...args) => api(...args),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    can: () => true,
  }),
}));

// Mock dedicated/embedded child pages to keep the layout test focused and light
vi.mock('./ProductMasterPage.jsx', () => ({
  default: () => <div data-testid="mock-product-master">Product Master Content</div>,
}));

vi.mock('./ExpenseMasterPage.jsx', () => ({
  default: () => <div data-testid="mock-expense-master">Expense Master Content</div>,
}));

vi.mock('../agreements/ContactDirectoryPage.jsx', () => ({
  default: () => <div data-testid="mock-contact-directory">Contact Directory Content</div>,
}));

describe('LogisticsMasterPage (Master One layout)', () => {
  beforeEach(() => {
    api.mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0, pages: 0 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders compact contextual navigation and eliminates the secondary vertical sidebar', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/master-one']}>
        <LogisticsMasterPage title="Reference data" initialEntity="products" />
      </MemoryRouter>
    );

    // Contextual navigation header is present
    expect(screen.getByRole('navigation', { name: 'Master One navigation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Current master directory: Products/i })).toBeTruthy();

    // Domain switcher pills are rendered
    expect(screen.getByRole('button', { name: 'Products' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Document One' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Camp One' })).toBeTruthy();

    // The legacy secondary vertical sidebar tree is completely gone
    expect(container.querySelector('.logistics-master-tree')).toBeNull();
    expect(container.querySelector('.logistics-master-group')).toBeNull();

    // The workspace container has full width
    const content = container.querySelector('.logistics-master-content');
    expect(content).toBeTruthy();
  });

  it('renders the requested master view in the full-width workspace', async () => {
    render(
      <MemoryRouter initialEntries={['/master-one?scope=document&entity=contacts']}>
        <LogisticsMasterPage title="Reference data" initialEntity="contacts" />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Current master directory: Contact Directory/i })).toBeTruthy();
    expect(await screen.findByTestId('mock-contact-directory')).toBeTruthy();
  });
});


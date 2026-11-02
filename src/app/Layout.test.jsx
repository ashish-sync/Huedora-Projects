import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout.jsx';

// Mock dependencies of Layout
vi.mock('../shared/auth.jsx', () => ({
  useAuth: () => ({
    user: { fullName: 'Alex Rivera', email: 'alex@tylo.com', role: 'admin' },
    logout: vi.fn(),
    can: () => true,
  }),
}));

vi.mock('../shared/theme.jsx', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../shared/api.js', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => '' },
    json: () => Promise.resolve({ data: { approvals: 0, fyi: 0 } }),
  }),
}));

describe('Layout Shell Architecture', () => {
  afterEach(() => {
    cleanup();
  });

  it('structures the layout with top-to-bottom sidebar on the left and header with logo on the right', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div data-testid="test-content">Dashboard Workspace</div>
        </Layout>
      </MemoryRouter>
    );

    const appShell = container.querySelector('.app-shell');
    expect(appShell).toBeTruthy();

    // 1. Sidebar wrapper is a direct child of app-shell (full height, top-to-bottom)
    const sidebarWrap = appShell.querySelector('.sidebar-drawer-wrap');
    expect(sidebarWrap).toBeTruthy();
    expect(sidebarWrap.parentElement).toBe(appShell);

    // 2. Expand bar is positioned on top of the sidebar
    const sidebarTopBar = sidebarWrap.querySelector('.sidebar-top-bar');
    expect(sidebarTopBar).toBeTruthy();
    expect(sidebarTopBar.querySelector('.sidebar-toggle-btn')).toBeTruthy();

    // 3. Right column contains header and main workspace
    const mainColumn = appShell.querySelector('.app-main-column');
    expect(mainColumn).toBeTruthy();
    expect(mainColumn.parentElement).toBe(appShell);

    // 4. Header is inside the right column, moving the logo with the header
    const header = mainColumn.querySelector('.app-header');
    expect(header).toBeTruthy();
    expect(header.parentElement).toBe(mainColumn);

    // Header contains the brand logo and wordmark
    const brandLink = header.querySelector('.brand');
    expect(brandLink).toBeTruthy();
    expect(brandLink.textContent).toContain('TYLO');
    expect(brandLink.textContent).toContain('One');

    // 5. Main content renders inside the right column under the header
    const mainContent = screen.getByTestId('test-content');
    expect(mainContent).toBeTruthy();
    expect(mainColumn.contains(mainContent)).toBe(true);
  });

  it('toggles mobile navigation drawer', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Mobile test content</div>
        </Layout>
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /open navigation/i });
    expect(toggleBtn).toBeTruthy();

    // Initially drawer is not open
    const sidebarWrap = container.querySelector('.sidebar-drawer-wrap');
    expect(sidebarWrap.classList.contains('is-mobile-open')).toBe(false);

    // Click hamburger button to open
    fireEvent.click(toggleBtn);
    expect(sidebarWrap.classList.contains('is-mobile-open')).toBe(true);

    // Click backdrop to close
    const backdrop = container.querySelector('.sidebar-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    expect(sidebarWrap.classList.contains('is-mobile-open')).toBe(false);
  });

  it('auto-collapses the sidebar when user picks a module from an expanded sidebar', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Workspace Content</div>
        </Layout>
      </MemoryRouter>
    );

    const sidebar = container.querySelector('aside.app-sidebar');

    // Expand the sidebar if collapsed
    if (sidebar.classList.contains('app-sidebar--collapsed')) {
      const expandBtn = screen.getByRole('button', { name: /expand navigation sidebar/i });
      fireEvent.click(expandBtn);
    }
    expect(sidebar.classList.contains('app-sidebar--collapsed')).toBe(false);

    // Pick a module (e.g. Camp One)
    const campLink = screen.getByRole('link', { name: /Camp One/i });
    fireEvent.click(campLink);

    // Sidebar should immediately auto-collapse
    expect(sidebar.classList.contains('app-sidebar--collapsed')).toBe(true);
    expect(localStorage.getItem('tylo:sidebar-collapsed')).toBe('true');
  });
});


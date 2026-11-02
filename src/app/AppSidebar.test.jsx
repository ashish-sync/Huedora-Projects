import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppSidebar from './AppSidebar.jsx';

describe('AppSidebar', () => {
  afterEach(() => {
    cleanup();
  });
  it('places the expand / collapse bar at the very top of the navigation sidebar', () => {
    const onToggle = vi.fn();
    const can = vi.fn().mockReturnValue(true);

    const { container } = render(
      <MemoryRouter>
        <AppSidebar
          pathname="/"
          can={can}
          isCollapsed={false}
          onToggleCollapse={onToggle}
        />
      </MemoryRouter>
    );

    const aside = container.querySelector('aside.app-sidebar');
    expect(aside).toBeTruthy();

    // Verify first child of aside is the top bar
    const firstChild = aside.firstElementChild;
    expect(firstChild.classList.contains('sidebar-top-bar')).toBe(true);

    // Verify the collapse button exists in the top bar
    const toggleBtn = screen.getByRole('button', { name: /collapse navigation sidebar/i });
    expect(toggleBtn).toBeTruthy();
    expect(firstChild.contains(toggleBtn)).toBe(true);

    // Verify clicking toggle triggers callback
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders collapsed state with expand toggle on top', () => {
    const onToggle = vi.fn();
    const can = vi.fn().mockReturnValue(true);

    const { container } = render(
      <MemoryRouter>
        <AppSidebar
          pathname="/"
          can={can}
          isCollapsed={true}
          onToggleCollapse={onToggle}
        />
      </MemoryRouter>
    );

    const aside = container.querySelector('aside.app-sidebar');
    expect(aside.classList.contains('app-sidebar--collapsed')).toBe(true);

    const expandBtn = screen.getByRole('button', { name: /expand navigation sidebar/i });
    expect(expandBtn).toBeTruthy();
    expect(aside.firstElementChild.contains(expandBtn)).toBe(true);
  });

  it('renders authorized modules and system links', () => {
    const can = vi.fn((perm) => perm.includes('camps') || perm.includes('dashboards'));

    render(
      <MemoryRouter>
        <AppSidebar pathname="/" can={can} isCollapsed={false} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Dashboard Home/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Operations/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Camp One/i })).toBeTruthy();
  });
});

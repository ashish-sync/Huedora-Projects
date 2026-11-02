import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import MasterNavHeader from './MasterNavHeader.jsx';

const MOCK_GROUPS = [
  {
    id: 'product-masters',
    label: 'Products',
    scope: 'inventory',
    entities: [
      { id: 'products', label: 'Products' },
    ],
  },
  {
    id: 'finance-masters',
    label: 'Finance',
    scope: 'movement',
    entities: [
      { id: 'vendors', label: 'Vendor Master' },
      { id: 'expense-categories', label: 'Expense Master' },
    ],
  },
  {
    id: 'document-masters',
    label: 'Document One',
    scope: 'document',
    entities: [
      { id: 'contacts', label: 'Contact Directory' },
      { id: 'templates', label: 'Document Templates' },
      { id: 'signatures', label: 'Signatures' },
      { id: 'picklist-approvals', label: 'Picklist approvals' },
    ],
  },
  {
    id: 'camp-masters',
    label: 'Camp One',
    scope: 'camp',
    entities: [
      { id: 'client-masters', label: 'Client Master' },
      { id: 'pin-codes', label: 'PIN Geography' },
    ],
  },
];

describe('MasterNavHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders active domain and master name in the trigger button', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[1]}
        activeEntity={MOCK_GROUPS[1].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /Current master directory: Vendor Master/i });
    expect(trigger).toBeTruthy();
    expect(screen.getAllByText('Finance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Vendor Master')).toBeTruthy();
  });

  it('renders all domain pills and marks the active domain', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[2]}
        activeEntity={MOCK_GROUPS[2].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    const docOnePill = screen.getByRole('button', { name: 'Document One' });
    expect(docOnePill).toBeTruthy();
    expect(docOnePill.className).toContain('is-active');

    const financePill = screen.getByRole('button', { name: 'Finance' });
    expect(financePill).toBeTruthy();
    expect(financePill.className).not.toContain('is-active');
  });

  it('switches to first entity of target domain when clicking a domain pill', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[0]}
        activeEntity={MOCK_GROUPS[0].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    const financePill = screen.getByRole('button', { name: 'Finance' });
    fireEvent.click(financePill);

    expect(onSelect).toHaveBeenCalledWith('vendors');
  });

  it('opens searchable popover dropdown on click', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[0]}
        activeEntity={MOCK_GROUPS[0].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /Current master directory/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Switch master directory' })).toBeTruthy();
    expect(screen.getByPlaceholderText(/Search master directories/i)).toBeTruthy();
    expect(screen.getByRole('option', { name: /Vendor Master/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Contact Directory/i })).toBeTruthy();
  });

  it('filters master directories by search query', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[0]}
        activeEntity={MOCK_GROUPS[0].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Current master directory/i }));
    const searchInput = screen.getByPlaceholderText(/Search master directories/i);

    fireEvent.change(searchInput, { target: { value: 'contact' } });

    expect(screen.getByRole('option', { name: /Contact Directory/i })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Vendor Master/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /Products/i })).toBeNull();
  });

  it('selects directory and closes popover when an option is clicked', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[0]}
        activeEntity={MOCK_GROUPS[0].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Current master directory/i }));
    const contactOption = screen.getByRole('option', { name: /Contact Directory/i });
    fireEvent.click(contactOption);

    expect(onSelect).toHaveBeenCalledWith('contacts');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes popover on Escape key', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[0]}
        activeEntity={MOCK_GROUPS[0].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Current master directory/i }));
    const searchInput = screen.getByPlaceholderText(/Search master directories/i);

    fireEvent.keyDown(searchInput, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('selects highlighted directory on Enter key', () => {
    const onSelect = vi.fn();
    render(
      <MasterNavHeader
        groups={MOCK_GROUPS}
        activeGroup={MOCK_GROUPS[0]}
        activeEntity={MOCK_GROUPS[0].entities[0]}
        onSelectEntity={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Current master directory/i }));
    const searchInput = screen.getByPlaceholderText(/Search master directories/i);

    // Search for pin codes
    fireEvent.change(searchInput, { target: { value: 'pin' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('pin-codes');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

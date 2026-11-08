import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormMasterPage from './FormMasterPage.jsx';

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}));

vi.mock('../../shared/api.js', () => ({
  api: (...args) => apiMock(...args),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    can: (perm) => perm === 'agreements:write' || perm === 'agreements:read' || perm === '*',
    user: { id: 'u-1', fullName: 'Admin' },
    loading: false,
  }),
}));

describe('FormMasterPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path, options = {}) => {
      const method = String(options.method || 'GET').toUpperCase();
      if (path === '/forms/meta') {
        return {
          data: {
            categories: [
              { id: 'PUBLIC_CAMP_REQUEST', label: 'Public Camp Request' },
              { id: 'OTHER', label: 'Other' },
            ],
            fieldTypes: [
              { id: 'text', label: 'Text' },
              { id: 'date', label: 'Date' },
              { id: 'number', label: 'Number' },
            ],
            fieldWidths: [
              { id: 'half', label: 'Half width' },
              { id: 'full', label: 'Full width' },
            ],
            fieldFormats: [
              { id: '', label: 'None' },
              { id: 'uppercase', label: 'Uppercase' },
            ],
            showOperators: [
              { id: 'eq', label: 'Equals' },
              { id: 'notEmpty', label: 'Is not empty' },
            ],
            templates: [
              {
                name: 'Public Camp Request',
                code: 'PUBLIC_CAMP_REQUEST',
                category: 'PUBLIC_CAMP_REQUEST',
                description: 'Default public camp request fields',
                fields: [
                  {
                    key: 'doctorName',
                    label: 'Doctor Name',
                    type: 'text',
                    required: true,
                    section: 'Doctor',
                    width: 'half',
                  },
                  {
                    key: 'campDate',
                    label: 'Camp Date',
                    type: 'date',
                    required: true,
                    section: 'Schedule',
                    width: 'half',
                  },
                ],
              },
            ],
          },
        };
      }
      if (String(path).startsWith('/forms') && method === 'GET') {
        return { data: [] };
      }
      if (path === '/forms' && method === 'POST') {
        return {
          data: {
            _id: 'f-1',
            ...options.body,
            fields: options.body.fields,
            isActive: true,
          },
        };
      }
      throw new Error(`Unexpected path: ${method} ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads the Public Camp Request template and saves a form format', async () => {
    const user = userEvent.setup();
    render(<FormMasterPage embedded />);

    expect(await screen.findByText(/Build a form format, then attach it under Client Master/i)).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: /Use Public Camp Request template/i }));

    expect(screen.getByPlaceholderText('e.g. Public Camp Request').value).toBe('Public Camp Request');
    expect(screen.getByDisplayValue('Doctor Name')).toBeTruthy();
    expect(screen.getByDisplayValue('PUBLIC_CAMP_REQUEST')).toBeTruthy();
    expect(screen.getByDisplayValue('Doctor')).toBeTruthy();
    expect(screen.getByLabelText(/Live form preview/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Save format/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        '/forms',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            name: 'Public Camp Request',
            code: 'PUBLIC_CAMP_REQUEST',
            category: 'PUBLIC_CAMP_REQUEST',
            fields: expect.arrayContaining([
              expect.objectContaining({
                key: 'doctorName',
                label: 'Doctor Name',
                section: 'Doctor',
              }),
            ]),
          }),
        }),
      );
    });
  });
});

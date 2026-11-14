import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientOneUserBase from './ClientOneUserBase.jsx';

const listMembers = vi.fn();
const createMember = vi.fn();
const updateMember = vi.fn();
const rotateMemberPin = vi.fn();

vi.mock('./clientOneApi.js', () => ({
  clientOneApi: {
    listMembers: (...args) => listMembers(...args),
    createMember: (...args) => createMember(...args),
    updateMember: (...args) => updateMember(...args),
    rotateMemberPin: (...args) => rotateMemberPin(...args),
  },
}));

describe('ClientOneUserBase', () => {
  afterEach(() => {
    cleanup();
    listMembers.mockReset();
    createMember.mockReset();
    updateMember.mockReset();
    rotateMemberPin.mockReset();
  });

  it('renders organogram nodes and opens detail on click', async () => {
    const user = userEvent.setup();
    listMembers.mockResolvedValue({
      tree: [
        {
          id: 'ho1',
          fullName: 'Head Office User',
          mobile: '9999999999',
          level: 'ho',
          status: 'active',
          designation: 'Director',
          regions: [],
          locations: [],
          children: [
            {
              id: 'reg1',
              fullName: 'West Regional',
              mobile: '8888888888',
              level: 'regional',
              parentId: 'ho1',
              status: 'active',
              regions: ['Maharashtra'],
              locations: [],
              children: [],
            },
          ],
        },
      ],
      members: [
        {
          id: 'ho1',
          fullName: 'Head Office User',
          mobile: '9999999999',
          level: 'ho',
          status: 'active',
          designation: 'Director',
          regions: [],
          locations: [],
        },
        {
          id: 'reg1',
          fullName: 'West Regional',
          mobile: '8888888888',
          level: 'regional',
          parentId: 'ho1',
          status: 'active',
          regions: ['Maharashtra'],
          locations: [],
        },
      ],
      capabilities: { canManage: true, role: 'programme', maxCreateLevel: 'ho' },
    });

    render(<ClientOneUserBase dateControls={null} />);

    await waitFor(() => {
      expect(screen.getByText('Head Office User')).toBeTruthy();
      expect(screen.getByText('West Regional')).toBeTruthy();
    });

    await user.click(screen.getByText('West Regional'));
    await waitFor(() => {
      expect(screen.getByText('Maharashtra')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add location' })).toBeTruthy();
    });
  });
});

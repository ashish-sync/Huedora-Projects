import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgramCampRequestLink } from './ProgramCampRequestLink.jsx';

const mintRequestFormLink = vi.fn();

vi.mock('../campOpsApi.js', () => ({
  clientMasterApi: {
    mintRequestFormLink: (...args) => mintRequestFormLink(...args),
  },
}));

afterEach(() => {
  cleanup();
  mintRequestFormLink.mockReset();
  vi.unstubAllGlobals();
});

describe('ProgramCampRequestLink', () => {
  it('does not mint until Program Configuration is saved', async () => {
    const user = userEvent.setup();
    render(<ProgramCampRequestLink persisted={false} recordId="" />);
    const button = screen.getByRole('button', { name: /copy camp request form link/i });
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(mintRequestFormLink).not.toHaveBeenCalled();
  });

  it('copies the minted program form url', async () => {
    const user = userEvent.setup();
    mintRequestFormLink.mockResolvedValue({
      data: { data: { url: 'https://qa.example/c/abc123', path: '/c/abc123', token: 'abc123' } },
    });
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<ProgramCampRequestLink persisted recordId="master-1" programActive />);
    await user.click(screen.getByRole('button', { name: /copy camp request form link/i }));

    expect(mintRequestFormLink).toHaveBeenCalledWith('master-1');
    expect(writeText).toHaveBeenCalledWith('https://qa.example/c/abc123');
    expect((await screen.findByRole('button', { name: /link copied/i })).textContent).toMatch(/link copied/i);
  });
});

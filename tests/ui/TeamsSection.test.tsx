// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeamsSection } from '@/ui/settings/TeamsSection';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsClient } from '@/teams/client';
import type { TeamsOp, TeamsReply } from '@/teams/messages';
import { ME } from '../teams/support';

const strings = getTeamsStrings('en');

function client(replies: Partial<Record<TeamsOp, TeamsReply>>, granted = true) {
  const c = {
    send: vi.fn(async (op: TeamsOp) => replies[op] ?? { status: { state: 'signed_out' } }),
    requestPermissions: vi.fn(async () => granted),
    removePermissions: vi.fn(async () => {}),
  };
  return c as typeof c & TeamsClient;
}

afterEach(cleanup);

describe('TeamsSection', () => {
  it('renders nothing in a build without Teams', async () => {
    const c = client({ status: { status: { state: 'unavailable' } } });
    const { container } = render(<TeamsSection lang="en" client={c} />);
    await waitFor(() => expect(c.send).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('asks for permissions from the click itself', async () => {
    const c = client({ status: { status: { state: 'permission_needed' } } });
    render(<TeamsSection lang="en" client={c} />);
    const button = await screen.findByRole('button', { name: strings.turnOn });
    c.send.mockResolvedValue({ status: { state: 'signed_out' } });
    fireEvent.click(button);
    // Requested synchronously in the handler, before anything was awaited.
    expect(c.requestPermissions).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: strings.signIn })).toBeInTheDocument();
  });

  it('says so when the permission is refused', async () => {
    const c = client({ status: { status: { state: 'permission_needed' } } }, false);
    render(<TeamsSection lang="en" client={c} />);
    fireEvent.click(await screen.findByRole('button', { name: strings.turnOn }));
    expect(await screen.findByText(strings.permissionDenied)).toBeInTheDocument();
  });

  it('shows the account exactly as the server reported it', async () => {
    const me = {
      ...ME,
      entitlement: {
        state: 'active',
        plan: 'teams',
        until: Date.UTC(2026, 11, 31),
        limits: { ownedTeams: 3, membersPerTeam: 10, notesPerTeam: 5000 },
        sources: ['subscription'],
      },
      teams: [{ id: 't1', name: 'One', role: 'member' }],
    } as const;
    const c = client({ status: { status: { state: 'signed_in', me: me as never } } });
    render(<TeamsSection lang="en" client={c} />);
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText(/^Active until /)).toBeInTheDocument();
    expect(screen.getByText(strings.memberOf(1))).toBeInTheDocument();
  });

  it('shows no plan when the server says there is none', async () => {
    const c = client({ status: { status: { state: 'signed_in', me: ME as never } } });
    render(<TeamsSection lang="en" client={c} />);
    expect(await screen.findByText(strings.planNone)).toBeInTheDocument();
  });

  it('reports a failed sign-in and stays signed out', async () => {
    const c = client({
      status: { status: { state: 'signed_out' } },
      signIn: { status: { state: 'signed_out' }, error: 'cancelled' },
    });
    render(<TeamsSection lang="en" client={c} />);
    fireEvent.click(await screen.findByRole('button', { name: strings.signIn }));
    expect(await screen.findByText(strings.error('cancelled'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: strings.signIn })).toBeInTheDocument();
  });

  it('turns Teams off: signs out, then gives the permissions back', async () => {
    const c = client({ status: { status: { state: 'signed_in', me: ME as never } } });
    render(<TeamsSection lang="en" client={c} />);
    const off = await screen.findByRole('button', { name: strings.turnOff });
    c.send.mockImplementation(async (op: TeamsOp) =>
      op === 'status'
        ? { status: { state: 'permission_needed' } }
        : { status: { state: 'signed_out' } },
    );
    fireEvent.click(off);
    expect(await screen.findByRole('button', { name: strings.turnOn })).toBeInTheDocument();
    expect(c.send).toHaveBeenCalledWith('signOut');
    expect(c.removePermissions).toHaveBeenCalledTimes(1);
  });
});

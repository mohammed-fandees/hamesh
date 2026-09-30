// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useTeams } from '@/ui/teams/useTeams';
import type { TeamsClient } from '@/teams/client';

const TEAM = '01J0000000000000000000000A';

/** A client whose two operations a test releases by hand. */
function fakeClient() {
  const release: Record<string, (value: unknown) => void> = {};
  const request = vi.fn(
    (op: string) =>
      new Promise((resolve) => {
        release[op] = resolve;
      }),
  );
  const client = {
    send: vi.fn(async () => ({ status: { state: 'signed_out' } })),
    request,
    cache: vi.fn(),
    onEvent: () => () => {},
    requestPermissions: vi.fn(),
    removePermissions: vi.fn(),
  } as unknown as TeamsClient;
  return { client, release };
}

/** Two rows, each doing its own thing, each saying so for itself. */
function Rows({ client }: { client: TeamsClient }) {
  const page = useTeams(client);
  return (
    <div>
      <button type="button" onClick={() => void page.run('team.get', { teamId: TEAM }, 'one')}>
        do one
      </button>
      <button type="button" onClick={() => void page.run('members.list', { teamId: TEAM }, 'two')}>
        do two
      </button>
      <span data-testid="one">
        {page.working('one') ? 'working' : (page.failed('one') ?? 'idle')}
      </span>
      <span data-testid="two">
        {page.working('two') ? 'working' : (page.failed('two') ?? 'idle')}
      </span>
      <span data-testid="page">{page.busy ? 'busy' : 'free'}</span>
    </div>
  );
}

afterEach(cleanup);

describe('what the page says is happening', () => {
  it('says it of the row that is acting, and of no other', async () => {
    const { client, release } = fakeClient();
    render(<Rows client={client} />);

    fireEvent.click(screen.getByText('do one'));
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('working'));
    expect(screen.getByTestId('two'), 'the other row carries on').toHaveTextContent('idle');
    expect(screen.getByTestId('page'), 'and so does the page').toHaveTextContent('free');

    release['team.get']!({ ok: true, data: {} });
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('idle'));
  });

  it('holds two rows at once, and lets each finish on its own', async () => {
    const { client, release } = fakeClient();
    render(<Rows client={client} />);

    fireEvent.click(screen.getByText('do one'));
    fireEvent.click(screen.getByText('do two'));
    await waitFor(() => expect(screen.getByTestId('two')).toHaveTextContent('working'));
    expect(screen.getByTestId('one')).toHaveTextContent('working');

    release['members.list']!({ ok: true, data: {} });
    await waitFor(() => expect(screen.getByTestId('two')).toHaveTextContent('idle'));
    expect(screen.getByTestId('one'), 'still going').toHaveTextContent('working');
  });

  it('reports a refusal against the row that was refused', async () => {
    const { client, release } = fakeClient();
    render(<Rows client={client} />);

    fireEvent.click(screen.getByText('do one'));
    release['team.get']!({ ok: false, error: 'forbidden' });
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('forbidden'));
    expect(screen.getByTestId('two'), 'which is not the other row’s problem').toHaveTextContent(
      'idle',
    );
  });

  it('does not wipe one row’s refusal because another row was pressed', async () => {
    const { client, release } = fakeClient();
    render(<Rows client={client} />);

    fireEvent.click(screen.getByText('do one'));
    release['team.get']!({ ok: false, error: 'forbidden' });
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('forbidden'));

    fireEvent.click(screen.getByText('do two'));
    await waitFor(() => expect(screen.getByTestId('two')).toHaveTextContent('working'));
    expect(screen.getByTestId('one')).toHaveTextContent('forbidden');
  });
});

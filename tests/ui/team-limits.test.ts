import { describe, it, expect } from 'vitest';
import { CreateTeamRequest } from '@hamesh/teams-contract/teams';
import { CreateFolderRequest } from '@hamesh/teams-contract/notes';
import { FOLDER_NAME_MAX } from '@/domain/folder';
import { TEAM_NAME_MAX } from '@/ui/teams/limits';

/** The pages restate the server's name limits (so zod stays out of them); these
 *  hold each restatement to the contract it restates. */
describe('name limits', () => {
  const at = (n: number) => 'x'.repeat(n);

  it('allows a team name exactly as long as the server does', () => {
    expect(
      CreateTeamRequest.safeParse({ name: at(TEAM_NAME_MAX), requestId: 'abcdefgh' }).success,
    ).toBe(true);
    expect(
      CreateTeamRequest.safeParse({ name: at(TEAM_NAME_MAX + 1), requestId: 'abcdefgh' }).success,
    ).toBe(false);
  });

  it('allows a team folder name exactly as long as a personal one', () => {
    expect(CreateFolderRequest.safeParse({ name: at(FOLDER_NAME_MAX) }).success).toBe(true);
    expect(CreateFolderRequest.safeParse({ name: at(FOLDER_NAME_MAX + 1) }).success).toBe(false);
  });
});

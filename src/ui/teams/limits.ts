/**
 * The longest a team's name may be once trimmed — the server's own limit
 * (`TeamName` in `@hamesh/teams-contract/teams`), restated here because the
 * contract module carries zod, which must stay off the pages' static import
 * path. `tests/ui/team-limits.test.ts` holds the two to each other.
 */
export const TEAM_NAME_MAX = 80;

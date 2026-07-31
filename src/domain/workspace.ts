/**
 * Every note belongs to a workspace. Hamesh has no multi-workspace feature
 * yet — there is exactly one, implicit, unselectable workspace today — but
 * every note already carries a real `workspaceId` so a future workspace
 * picker only needs to start filtering by it, not add it retroactively.
 */
export type WorkspaceId = string;

export const DEFAULT_WORKSPACE_ID: WorkspaceId = 'default';

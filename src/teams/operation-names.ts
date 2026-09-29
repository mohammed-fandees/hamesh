/**
 * The names of the operations a page may ask for, and nothing else.
 *
 * Deliberately apart from `./operations.ts`: that module imports zod and the
 * whole contract to describe each operation, and the background worker's
 * message handling only ever needs to know whether a name is real. Keeping the
 * two apart is what lets a build without Teams carry neither.
 */
export const OPERATION_NAMES = [
  'team.get',
  'team.create',
  'team.rename',
  'team.delete',
  'team.transfer',
  'members.list',
  'members.setRole',
  'members.remove',
  'invites.list',
  'invites.create',
  'invites.revoke',
  'invites.preview',
  'invites.accept',
  'notes.changes',
  'notes.share',
  'notes.update',
  'notes.delete',
  'notes.unshare',
  'folders.create',
  'folders.rename',
  'folders.delete',
  'realtime.ticket',
  'billing.plans',
  'billing.payments',
  'billing.submit',
] as const;

export type TeamsOpName = (typeof OPERATION_NAMES)[number];

export function isOperationName(value: unknown): value is TeamsOpName {
  return (OPERATION_NAMES as readonly unknown[]).includes(value);
}

/** A client-generated idempotency key: a retried create returns the original. */
export const newRequestId = (): string =>
  `${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

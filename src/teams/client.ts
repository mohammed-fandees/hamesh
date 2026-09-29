import { browser } from 'wxt/browser';
import { teamsPermissions, type TeamsConfig } from './config';
import type { ResultFor, TeamsOp, TeamsReply } from './messages';
import type { TeamsOpName } from './operation-names';
import type { ParamsOf } from './operations';

/**
 * What Hamesh's pages use to drive Teams. The work happens in the background
 * service worker; this only asks, and hands back the status the server gave.
 */
export interface TeamsClient {
  send(op: TeamsOp): Promise<TeamsReply>;
  /** Performs one listed operation (see ./operations.ts) in the worker. */
  request<K extends TeamsOpName>(op: K, params: ParamsOf<K>): Promise<ResultFor<K>>;
  /**
   * Asks the user for the Teams permissions. Must be called straight from a
   * click: browsers only show the prompt in response to a user gesture.
   */
  requestPermissions(): Promise<boolean>;
  /** Gives the permissions back, which also forgets the session on this device. */
  removePermissions(): Promise<void>;
}

export function createTeamsClient(config: TeamsConfig): TeamsClient {
  return {
    async send(op) {
      const reply = (await browser.runtime.sendMessage({ type: 'TEAMS', op })) as
        TeamsReply | undefined;
      // No answer means the worker has no Teams handler (it shouldn't happen
      // in a build that shows the Teams UI); treat it as unavailable.
      return reply ?? { status: { state: 'unavailable' }, error: 'not_configured' };
    },
    async request(op, params) {
      const reply = (await browser.runtime.sendMessage({ type: 'TEAMS_OP', op, params })) as
        ResultFor<typeof op> | undefined;
      // No answer at all means no Teams handler in this worker.
      return reply ?? { ok: false, error: 'not_configured' };
    },
    requestPermissions() {
      return browser.permissions.request(teamsPermissions(config));
    },
    async removePermissions() {
      await browser.permissions.remove(teamsPermissions(config));
    },
  };
}

import { browser } from 'wxt/browser';
import { teamsPermissions, type TeamsConfig } from './config';
import {
  isTeamsEvent,
  type ResultFor,
  type TeamCacheResult,
  type TeamsCacheOp,
  type TeamsEvent,
  type TeamsOp,
  type TeamsReply,
} from './messages';
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
   * Reads the team-note cache this device already holds — `'notes'` for what is
   * there now, `'sync'` to have the worker pull first.
   */
  cache(op: TeamsCacheOp, teamId: string): Promise<TeamCacheResult>;
  /**
   * Listens for the worker's notices that something changed in a team, so a
   * page showing it can catch up. Ids only; the page fetches the rest itself.
   */
  onEvent(listener: (event: TeamsEvent) => void): () => void;
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
    async cache(op, teamId) {
      const reply = (await browser.runtime.sendMessage({ type: 'TEAMS_CACHE', op, teamId })) as
        TeamCacheResult | undefined;
      return reply ?? { ok: false, error: 'not_configured' };
    },
    onEvent(listener) {
      // Returns nothing, so the worker is never left waiting on a page.
      const handler = (message: unknown): undefined => {
        if (isTeamsEvent(message)) listener(message);
        return undefined;
      };
      browser.runtime.onMessage.addListener(handler);
      return () => browser.runtime.onMessage.removeListener(handler);
    },
    requestPermissions() {
      return browser.permissions.request(teamsPermissions(config));
    },
    async removePermissions() {
      await browser.permissions.remove(teamsPermissions(config));
    },
  };
}

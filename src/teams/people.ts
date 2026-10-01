import type { TeamsApi } from './api';
import { MAX_PEOPLE, type CachedPerson, type PeopleDirectory } from './people-cache';

/**
 * Keeps the people directory (./people-cache.ts) in step with the teams: who is
 * in each, by name, and their picture — fetched here, in the worker, once per
 * picture, so no web page ever asks for one.
 *
 * Asked again when the teams change, when the server says a team's members
 * did, and otherwise no more than every few hours: a name or a picture that
 * changed on Google is caught up with then, which is soon enough for a pin.
 *
 * Runs only in the background service worker.
 */

/** How long a directory is trusted before it is gathered again. */
export const PEOPLE_TTL = 6 * 60 * 60 * 1000;

/** The largest picture kept. Google's are a few kilobytes at the size it serves. */
export const MAX_PHOTO_BYTES = 64 * 1024;

const IMAGE_TYPE = /^image\/(png|jpeg|webp|gif)$/;

export interface PeopleDeps {
  api: Pick<TeamsApi, 'run'>;
  read: () => Promise<PeopleDirectory>;
  write: (directory: PeopleDirectory) => Promise<void>;
  fetch: typeof fetch;
  now: () => number;
}

/** Only a picture on Google's own image host, over https — the server keeps
 *  no other, and this does not trust that it never will. */
export function photoSource(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname;
    if (host !== 'googleusercontent.com' && !host.endsWith('.googleusercontent.com')) return null;
    return url.href;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** One picture as a `data:` URL, or null when it is missing, odd or too big. */
export async function fetchPhoto(fetcher: typeof fetch, source: string): Promise<string | null> {
  try {
    const response = await fetcher(source, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPE.test(type)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return null;
    return `data:${type};base64,${toBase64(bytes)}`;
  } catch {
    return null;
  }
}

const sameTeams = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

export function createPeople(deps: PeopleDeps) {
  let running: Promise<void> | null = null;

  async function gather(teamIds: string[], me: string, force: boolean): Promise<void> {
    const current = await deps.read();
    const fresh = deps.now() - current.syncedAt < PEOPLE_TTL;
    if (!force && fresh && current.me === me && sameTeams(current.teamIds, teamIds)) return;

    const people: Record<string, CachedPerson> = {};
    let count = 0;
    for (const teamId of teamIds) {
      // A team that cannot be asked right now leaves the whole directory as it
      // was: half of one would turn people back into monograms for nothing.
      const { members } = await deps.api.run('members.list', { teamId });
      for (const member of members) {
        if (people[member.userId] || count >= MAX_PEOPLE) continue;
        const source = photoSource(member.avatarUrl);
        const known = current.people[member.userId];
        const photo =
          source && known?.source === source && known.photo
            ? known.photo
            : source
              ? await fetchPhoto(deps.fetch, source)
              : null;
        // A picture that would not come is asked for again next time.
        people[member.userId] = {
          name: member.displayName,
          photo,
          source: photo ? source : null,
        };
        count += 1;
      }
    }
    await deps.write({ people, me, teamIds: [...teamIds], syncedAt: deps.now() });
  }

  return {
    /**
     * Gathers the directory for these teams, as seen by this user, unless it
     * was just gathered for them; `force` gathers it regardless. One at a time: a second ask while
     * one runs waits for it and is then satisfied by what it wrote.
     */
    async refresh(teamIds: string[], me: string, force = false): Promise<void> {
      while (running) await running.catch(() => {});
      running = gather(teamIds, me, force).finally(() => {
        running = null;
      });
      return running;
    },
  };
}

export type People = ReturnType<typeof createPeople>;

/**
 * The people in this account's teams, as the content script draws them: a name
 * and a picture for the pin that marks a shared note on the page.
 *
 * Written only by the background worker (see ./people.ts), which asks the
 * server who is in each team and fetches each picture itself, once, keeping it
 * here as a `data:` URL. So a web page Hamesh draws on never asks Google for a
 * picture, and never learns whose it is from a request it could see.
 *
 * Read by the content script — and so, like ./page-cache.ts, zod-free and
 * contract-free, every value parsed by hand. No email, nothing about a person
 * beyond what a shared note on the page already shows: who wrote it.
 */

const PEOPLE_KEY = 'local:hamesh:team-people';

/** At most this many people are kept: a guard on the storage it takes. */
export const MAX_PEOPLE = 300;

/** One person, as a pin shows them. */
export interface CachedPerson {
  name: string;
  /** Their picture as a `data:` URL, or null for a monogram. */
  photo: string | null;
  /** The address the picture was fetched from — what tells the worker it is
   *  still the same picture and need not be fetched again. */
  source: string | null;
}

export interface PeopleDirectory {
  /** By user id, across every team this account is in. */
  people: Record<string, CachedPerson>;
  /** The teams this was gathered from, in the order asked. */
  teamIds: string[];
  /** When the worker last wrote it, or 0 when it never has. */
  syncedAt: number;
}

const EMPTY: PeopleDirectory = { people: {}, teamIds: [], syncedAt: 0 };

/** Only a picture this worker produced: an image as a base64 `data:` URL. */
const PHOTO = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function parsePeople(data: unknown): PeopleDirectory {
  if (!data || typeof data !== 'object') return EMPTY;
  const raw = data as { people?: unknown; teamIds?: unknown; syncedAt?: unknown };
  const people: Record<string, CachedPerson> = {};
  if (raw.people && typeof raw.people === 'object') {
    for (const [id, value] of Object.entries(raw.people).slice(0, MAX_PEOPLE)) {
      if (!value || typeof value !== 'object') continue;
      const p = value as { name?: unknown; photo?: unknown; source?: unknown };
      if (typeof p.name !== 'string') continue;
      people[id] = {
        name: p.name,
        photo: typeof p.photo === 'string' && PHOTO.test(p.photo) ? p.photo : null,
        source: typeof p.source === 'string' ? p.source : null,
      };
    }
  }
  const teamIds = Array.isArray(raw.teamIds)
    ? raw.teamIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { people, teamIds, syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : 0 };
}

export function readPeople(): Promise<PeopleDirectory> {
  return storage.getItem<unknown>(PEOPLE_KEY).then(parsePeople);
}

/** Fires whenever the worker rewrites who is who. */
export function watchPeople(cb: (people: PeopleDirectory) => void): () => void {
  return storage.watch<unknown>(PEOPLE_KEY, (value) => cb(parsePeople(value)));
}

// ---- The worker's side: the only writer ----

export async function writePeople(directory: PeopleDirectory): Promise<void> {
  await storage.setItem(PEOPLE_KEY, directory);
}

export async function clearPeople(): Promise<void> {
  await storage.removeItem(PEOPLE_KEY);
}

import { z } from 'zod';

/**
 * What Hamesh wants to tell its readers, written in the admin panel. Public: no
 * session, and nothing about who is asking is sent or kept.
 *
 * Plain text in both languages, and at most one action, which either opens a
 * named place in the extension or is an https link. The client renders text as
 * text; nothing here can carry markup or script.
 */

const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

const localized = (max: number) =>
  z.strictObject({ en: z.string().min(1).max(max), ar: z.string().min(1).max(max) });

export const ANNOUNCEMENT_TITLE_MAX = 80;
export const ANNOUNCEMENT_BODY_MAX = 200;
export const ANNOUNCEMENT_ACTION_MAX = 30;
/** The most the server hands out at once. */
export const ANNOUNCEMENTS_MAX = 3;

export const ANNOUNCEMENT_DESTINATIONS = [
  'teams',
  'plan',
  'settings',
  'whats-new',
  'start',
] as const;

export const ANNOUNCEMENT_AUDIENCES = ['everyone', 'not_in_a_team', 'in_a_team'] as const;

const HttpsUrl = z
  .string()
  .max(500)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  });

export const Announcement = z.strictObject({
  id: Ulid,
  title: localized(ANNOUNCEMENT_TITLE_MAX),
  body: localized(ANNOUNCEMENT_BODY_MAX).nullable(),
  action: z
    .strictObject({
      label: localized(ANNOUNCEMENT_ACTION_MAX),
      to: z.union([
        z.strictObject({ open: z.enum(ANNOUNCEMENT_DESTINATIONS) }),
        z.strictObject({ url: HttpsUrl }),
      ]),
    })
    .nullable(),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES),
});
export type Announcement = z.infer<typeof Announcement>;

/** GET /v1/announcements — what is running now, most important first. */
export const AnnouncementsResponse = z.strictObject({
  announcements: z.array(Announcement).max(ANNOUNCEMENTS_MAX),
});
export type AnnouncementsResponse = z.infer<typeof AnnouncementsResponse>;

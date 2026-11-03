import { describe, expect, it } from 'vitest';
import { announcementsToShow, MAX_ANNOUNCEMENTS, type Announcement } from '@/domain/announcements';
import { DEFAULT_ANNOUNCEMENT_PREFERENCES, parsePreferences } from '@/domain/preferences';

const item = (id: string, audience: Announcement['audience'] = 'everyone'): Announcement => ({
  id,
  title: { en: id, ar: id },
  body: null,
  action: null,
  audience,
});
const NOW = 1_000_000;
const stranger = { inTeam: false };

describe('announcementsToShow', () => {
  it('keeps the server’s order', () => {
    const shown = announcementsToShow(
      [item('a'), item('b')],
      DEFAULT_ANNOUNCEMENT_PREFERENCES,
      NOW,
      stranger,
    );
    expect(shown.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('never shows more than the slot can hold', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id));
    expect(announcementsToShow(many, DEFAULT_ANNOUNCEMENT_PREFERENCES, NOW, stranger)).toHaveLength(
      MAX_ANNOUNCEMENTS,
    );
  });

  it('shows nothing once the reader has turned them off', () => {
    expect(
      announcementsToShow(
        [item('a')],
        { ...DEFAULT_ANNOUNCEMENT_PREFERENCES, enabled: false },
        NOW,
        stranger,
      ),
    ).toEqual([]);
  });

  it('never brings back one the reader said not to show again', () => {
    const prefs = { ...DEFAULT_ANNOUNCEMENT_PREFERENCES, dismissed: ['a'] };
    expect(announcementsToShow([item('a'), item('b')], prefs, NOW, stranger)).toEqual([item('b')]);
  });

  it('brings a closed one back once its time is up', () => {
    const prefs = { ...DEFAULT_ANNOUNCEMENT_PREFERENCES, snoozedUntil: { a: NOW + 1 } };
    expect(announcementsToShow([item('a')], prefs, NOW, stranger)).toEqual([]);
    expect(announcementsToShow([item('a')], prefs, NOW + 1, stranger)).toEqual([item('a')]);
  });

  it('tells Teams only to those not in one, and team news only to those who are', () => {
    const all = [item('sell', 'not_in_a_team'), item('news', 'in_a_team')];
    const prefs = DEFAULT_ANNOUNCEMENT_PREFERENCES;
    expect(announcementsToShow(all, prefs, NOW, { inTeam: false }).map((a) => a.id)).toEqual([
      'sell',
    ]);
    expect(announcementsToShow(all, prefs, NOW, { inTeam: true }).map((a) => a.id)).toEqual([
      'news',
    ]);
  });
});

describe('what is remembered about them', () => {
  it('starts on, with nothing closed', () => {
    expect(parsePreferences({}).announcements).toEqual(DEFAULT_ANNOUNCEMENT_PREFERENCES);
  });

  it('drops anything malformed rather than trusting it', () => {
    expect(
      parsePreferences({
        announcements: {
          enabled: 'yes',
          dismissed: ['a', 3],
          snoozedUntil: { a: 5, b: 'soon' },
        },
      }).announcements,
    ).toEqual({ enabled: true, dismissed: ['a'], snoozedUntil: { a: 5 } });
  });

  it('keeps the guide off unless a fresh install turned it on', () => {
    expect(parsePreferences({}).onboarding.guide).toBe('hidden');
    expect(parsePreferences({ onboarding: { guide: 'showing' } }).onboarding.guide).toBe('showing');
    expect(parsePreferences({ onboarding: { guide: 'nonsense' } }).onboarding.guide).toBe('hidden');
  });
});

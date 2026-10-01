import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Sidebar, type LibraryView as View } from '@/ui/library/Sidebar';
import { LibraryView } from '@/ui/library/LibraryView';
import { NoteActionsContext, type NoteActions } from '@/ui/library/NoteActions';
import { NoteDiscussSlot, NoteShareSlot, type DiscussAction } from '@/ui/library/NoteShareSlot';
import { LibrarySettingsView } from '@/ui/settings/LibrarySettingsView';
import { WhatsNewView } from '@/ui/WhatsNewView';
import { Page, PageHeader } from '@/ui/kit/Page';
import { getStrings, resolveLang, dirForLang } from '@/ui/i18n';
import { usePreferences, systemTheme } from '@/ui/hooks/usePreferences';
import { useFolders } from '@/ui/hooks/useFolders';
import { useNoteMutations } from '@/ui/hooks/useNoteMutations';
import { usePageBackground } from '@/ui/hooks/usePageBackground';
import { createNotesRepository } from '@/storage/notes-repository';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { createFoldersRepository } from '@/storage/folders-repository';
import { flattenFolderTree } from '@/domain/folder-grouping';
import { resolveTheme } from '@/domain/preferences';
import { getLatestReleaseVersion, hasUnseenReleases } from '@/domain/release-notes';
import type { NoteOwner } from '@/domain/note-owner';
import {
  backupFileName,
  buildBackup,
  mergeFolders,
  mergeNotes,
  parseBackup,
  serializeBackup,
} from '@/domain/backup';
import type { BackupImportOutcome } from '@/ui/settings/BackupSection';
import { teamsConfig } from '@/teams/config';
import { createTeamsClient } from '@/teams/client';
import { TeamsView } from '@/ui/teams/TeamsView';
import { ShareNoteAction } from '@/ui/teams/ShareNoteAction';
import { ShareConsent } from '@/ui/teams/ShareConsent';
import { PanelView } from '@/ui/teams/PanelView';
import { shareNote } from '@/ui/teams/share-note';
import type { TeamLibraryActions } from '@/ui/teams/TeamSpace';
import { Failure } from '@/ui/hooks/useWork';
import { OVERVIEW, routeFromParams, routeToParams, type TeamsRoute } from '@/ui/teams/route';
import { generatePageKey } from '@/domain/page-key';
import { watchTeamIndex } from '@/teams/page-cache';
import {
  newestMentionId,
  readTeamNotesForLibrary,
  NO_TEAM_NOTES,
  type LibraryTeamNotes,
} from '@/ui/teams/library-notes';
import { MentionsInbox } from '@/ui/teams/MentionsInbox';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { PersonalNotes } from '@/ui/teams/personal-notes';
import { isSharedNote, type Note } from '@/domain/note';
import '@/ui/tokens.css';
import '@/ui/pages.css';
import '@/ui/notes-library.css';

const initialLang = resolveLang(browser.i18n?.getUILanguage?.());
// Lets another context deep-link straight to a view instead of always
// opening to Library: the popup's "Open full settings" link
// (`notes.html?view=settings`), and the tab the background opens after an
// update (`notes.html?view=whats-new`). Every view the sidebar offers is
// reachable this way, so a link can point at one — anything else opens the
// Library, as an unrecognised view always has.
const DEEP_LINKS: readonly View[] = ['library', 'settings', 'teams', 'mentions', 'whats-new'];
/** A part of Settings a link can open straight onto — `?view=settings&focus=plan`. */
type SettingsFocus = 'plan';
/** Where an address says the reader is: a view, and inside Teams, a place in it. */
interface Place {
  view: View;
  teams: TeamsRoute;
  /** In Settings, the panel to open and bring into view. */
  focus: SettingsFocus | null;
  /** In the Library, a note to find and show — `?view=library&note=<id>`,
   *  from a note's menu on a page. */
  note: string | null;
}
function placeFrom(search: string): Place {
  const params = new URLSearchParams(search);
  const requested = params.get('view');
  return {
    view: DEEP_LINKS.includes(requested as View) ? (requested as View) : 'library',
    teams: routeFromParams(params),
    focus: params.get('focus') === 'plan' ? 'plan' : null,
    note: requested === 'library' ? params.get('note') : null,
  };
}
const initialPlace = placeFrom(location.search);
/**
 * Opened in Chrome's side panel (`?view=panel`, set by the worker for the tab a
 * shared note was opened from): the page is the panel and nothing else — no
 * sidebar, no other views. Teams only.
 */
const panelPlace = (() => {
  const params = new URLSearchParams(location.search);
  if (params.get('view') !== 'panel') return null;
  return {
    teamId: params.get('team'),
    noteId: params.get('note'),
    pageKey: params.get('pagekey'),
  };
})();
// The build's own version, so What's New can mark the entry actually
// installed rather than assuming it's the newest one listed.
const currentVersion = browser.runtime.getManifest().version;
/** This page has no website to match, so "Match website" follows the system. */
const matched = systemTheme();
/** What "a note moves between this device and a team" means when there are no
 *  teams: nothing at all. Named here so the real one below can sit behind this
 *  build's Teams constant. */
const NO_SHARING: PersonalNotes = { forget: async () => {}, keep: async () => {} };

const repo = createNotesRepository();
const prefsRepo = createPreferencesRepository();
const foldersRepo = createFoldersRepository();

export function App() {
  const [place, setPlace] = useState<Place>(initialPlace);
  const view = place.view;
  const placeRef = useRef(place);
  useEffect(() => {
    placeRef.current = place;
  }, [place]);
  /**
   * Moves to a view, and — for Teams — to a place inside it.
   *
   * Switching between the sidebar's views is not a navigation: the same document
   * shows another view, and the address does not change (a reload opens the
   * Library, as it always has). Only a page reached *from* Teams — a team's
   * members, one shared note — is a history entry, so the browser's back button
   * returns to where the reader came from instead of leaving the Library
   * altogether, and so the page can be linked to. Each entry carries the place
   * it stands for, because the address alone cannot say where a sidebar switch
   * left the reader.
   */
  const navigate = useCallback(
    (next: View, teams: TeamsRoute = OVERVIEW, focus: SettingsFocus | null = null) => {
      const target: Place = { view: next, teams, focus, note: null };
      const deep = next === 'teams' && teams.page !== 'overview';
      if (deep) {
        // Remember where this entry is before stepping past it.
        history.replaceState({ place: placeRef.current }, '');
        const params = new URLSearchParams({ view: 'teams', ...routeToParams(teams) });
        history.pushState({ place: target }, '', `?${params}`);
      } else if (new URLSearchParams(location.search).has('page')) {
        // Leaving a linkable page for a top-level one: the address should not go on
        // saying the reader is somewhere they no longer are.
        history.replaceState({ place: target }, '', location.pathname);
      }
      setPlace(target);
    },
    [],
  );
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const remembered = (event.state as { place?: Place } | null)?.place;
      setPlace(remembered ?? placeFrom(location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const preferences = usePreferences(prefsRepo);
  const { prefs, first } = preferences;
  const lang = prefs?.language ?? initialLang;
  const strings = getStrings(lang);
  const dir = dirForLang(lang);
  const theme = resolveTheme(prefs?.appearance ?? 'match-website', matched);
  const scopeRef = useRef<HTMLDivElement>(null);
  usePageBackground(scopeRef, '--hm-paper', theme);

  /** This device's notes; `null` while the first read is in flight, so the
   *  empty state never flashes before the notes arrive. */
  const [notes, setNotes] = useState<Note[] | null>(null);
  const notesRef = useRef<Note[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await repo.getAll().catch(() => [] as Note[]);
      if (cancelled) return;
      notesRef.current = all;
      setNotes(all);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const mutations = useNoteMutations(
    repo,
    useMemo(
      () => ({
        current: () => notesRef.current ?? [],
        commit: (next: Note[]) => {
          notesRef.current = next;
          setNotes(next);
        },
      }),
      [],
    ),
  );
  const { folders, create: createFolder } = useFolders(foldersRepo);

  /** Every team note this device holds, and the teams they came from. Always
   *  empty in a build without Teams, and while nobody is signed in. */
  const [shared, setShared] = useState<LibraryTeamNotes>(NO_TEAM_NOTES);
  /** Whose notes the library is showing. */
  const [owner, setOwner] = useState<NoteOwner>('all');
  /** The newest mention the server has — against the newest the reader has
   *  looked at, what puts a dot on Mentions in the sidebar. */
  const [newestMention, setNewestMention] = useState<string | null>(null);
  /** A share waiting on the reader's consent, and how to answer it. */
  const [consent, setConsent] = useState<{
    teamName: string;
    answer: (share: boolean) => void;
  } | null>(null);

  // Null in builds without Teams, which leaves Settings exactly as it was.
  const teamsClient = useMemo(() => {
    // A build-time constant: builds without Teams drop this code entirely.
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return null;
    const config = teamsConfig();
    return config ? createTeamsClient(config) : null;
  }, []);

  // The team notes this device already holds, beside the reader's own. Nothing
  // is fetched from the server here: the worker pulled each team's changes and
  // filed them, and this asks it for what it has. Re-read when the set of teams
  // changes, and when the window comes back — a pull may have landed while it
  // was in the background.
  const loadShared = useCallback(async () => {
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN || !teamsClient) return;
    setShared(await readTeamNotesForLibrary(teamsClient).catch(() => NO_TEAM_NOTES));
  }, [teamsClient]);

  useEffect(() => {
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN || !teamsClient) return;
    let cancelled = false;
    void (async () => {
      const next = await readTeamNotesForLibrary(teamsClient).catch(() => NO_TEAM_NOTES);
      if (!cancelled) setShared(next);
      const newest = await newestMentionId(teamsClient).catch(() => null);
      if (!cancelled) setNewestMention(newest);
    })();
    const unwatch = watchTeamIndex(() => void loadShared());
    const onFocus = () => void loadShared();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      unwatch();
      window.removeEventListener('focus', onFocus);
    };
  }, [teamsClient, loadShared]);

  // Opening What's New *is* reading it — the badge and the auto-open both key
  // off this, so it's recorded on arrival rather than on some "mark as read"
  // nobody would click. The view reads what had been seen from `first`, so its
  // entries stay marked "New" while they're being read.
  const lastSeenVersion = first?.releaseNotes.lastSeenVersion;
  useEffect(() => {
    if (view !== 'whats-new' || lastSeenVersion === undefined) return;
    const latest = getLatestReleaseVersion();
    if (lastSeenVersion === latest) return;
    void prefsRepo.setLastSeenReleaseVersion(latest);
  }, [view, lastSeenVersion]);

  /**
   * Export — everything, to a file the user chooses where to keep.
   *
   * Reads storage directly rather than the `notes` already in state: a backup
   * must be the whole truth at the moment it's taken, not whatever the current
   * view happens to be filtered to.
   */
  async function handleExportBackup(): Promise<{ notes: number; folders: number }> {
    const [allNotes, allFolders] = await Promise.all([repo.getAll(), foldersRepo.getAll()]);
    const backup = buildBackup({
      notes: allNotes,
      folders: allFolders,
      appVersion: currentVersion,
    });
    const url = URL.createObjectURL(
      new Blob([serializeBackup(backup)], { type: 'application/json' }),
    );
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName();
      link.click();
    } finally {
      // Freed on the next tick — revoking synchronously can cancel the
      // download the click just started.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    return { notes: allNotes.length, folders: allFolders.length };
  }

  /**
   * Import — merge a backup file back in.
   *
   * Reads the current contents fresh, merges by the rules in `domain/backup.ts`
   * (never deletes; newer edit wins), then writes. If a write fails partway the
   * user still has everything they had before, because nothing is ever removed
   * first.
   */
  async function handleImportBackup(text: string): Promise<BackupImportOutcome> {
    const parsed = parseBackup(text);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };

    const [existingNotes, existingFolders] = await Promise.all([
      repo.getAll(),
      foldersRepo.getAll(),
    ]);
    const mergedNotes = mergeNotes(existingNotes, parsed.backup.notes);
    const mergedFolders = mergeFolders(existingFolders, parsed.backup.folders);

    const noteChanges = mergedNotes.added + mergedNotes.updated;
    const folderChanges = mergedFolders.added + mergedFolders.updated;
    // Nothing new in the file: skip the writes entirely rather than rewriting
    // every page bucket for no reason.
    if (noteChanges === 0 && folderChanges === 0) return { ok: true, notes: 0, folders: 0 };

    // Folders first: a note carrying a `folderId` should never be visible for
    // even a moment before the folder it points at exists.
    if (folderChanges > 0) await foldersRepo.saveAll(mergedFolders.items);
    if (noteChanges > 0) await repo.saveAll(mergedNotes.items);

    notesRef.current = mergedNotes.items;
    setNotes(mergedNotes.items);
    return { ok: true, notes: noteChanges, folders: folderChanges };
  }

  /** Deleting a folder takes every folder inside it too, and unfiles — never
   *  deletes — the notes that were in any of them. The two repositories stay
   *  apart, so the two steps meet here. */
  async function deleteFolder(folderId: string) {
    const { removedFolderIds } = await foldersRepo.remove(folderId);
    await mutations.unfile(new Set(removedFolderIds));
  }

  /** What every note row in the Library can do — see `NoteActions`. */
  const noteActions = useMemo<NoteActions>(
    () => ({
      togglePin: (id) => void mutations.togglePin(id),
      edit: async (id, content) => (await mutations.update(id, content)) !== null,
      remove: (id) => mutations.remove(id),
      move: (id, folderId) => void mutations.move(id, folderId),
      createFolder: async (name) => (await createFolder({ name, parentId: null })).id,
      folders: flattenFolderTree(folders ?? []),
      busy: mutations.busy,
      failed: mutations.failed,
    }),
    [mutations, folders, createFolder],
  );

  /**
   * How a note crosses between this device and a team. Sharing moves it: the
   * team's copy is what the page then shows, so keeping a personal one as well
   * would draw the same note twice. Unsharing moves it back.
   *
   * Only built in a build that has Teams — the constant is folded away in every
   * other one, and with it everything this reaches.
   */
  const personalNotes = useMemo<PersonalNotes>(() => {
    // The build-time constant first, so a build without Teams keeps neither
    // this nor what it reaches (the page-key helper among it).
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return NO_SHARING;
    return {
      forget: async (noteId) => {
        await mutations.remove(noteId);
      },
      keep: async (note) => {
        await mutations.create({
          content: note.content,
          pageKey: generatePageKey(note.originalUrl),
          originalUrl: note.originalUrl,
          anchor: note.anchor,
          ...(note.pageTitle ? { pageContext: { title: note.pageTitle } } : {}),
        });
      },
    };
  }, [mutations]);

  const skipConsent = prefs?.teams.skipShareConsent ?? false;

  /**
   * Shares one of this device's notes with a team — from its menu or by
   * dropping it on a team's folder, the same way either way. Asks first (unless
   * the reader said not to), then moves the note: the team's copy is read back
   * before the local one goes, so the row never blinks out of the list.
   * Resolves `false` if the reader declined; fails with the server's refusal.
   */
  const shareToTeam = useCallback(
    async (note: Note, teamId: string, folderId: string | null): Promise<boolean> => {
      if (!import.meta.env.WXT_TEAMS_API_ORIGIN || !teamsClient) return false;
      const teamName = shared.teams.find((t) => t.id === teamId)?.name ?? '';
      const agreed =
        skipConsent || (await new Promise<boolean>((answer) => setConsent({ teamName, answer })));
      if (!agreed) return false;
      await shareNote(teamsClient, note, teamId, folderId);
      await loadShared();
      await personalNotes.forget(note.id);
      return true;
    },
    [teamsClient, shared.teams, skipConsent, loadShared, personalNotes],
  );

  /** The "Share with team" item in a note's actions menu. */
  const shareAction = useMemo(() => {
    // A build-time constant first: with it folded away, nothing below is
    // reachable and the Teams module this reaches is dropped from the bundle.
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return null;
    if (!teamsClient || shared.teams.length === 0) return null;
    return (note: Note, close: () => void) => (
      <ShareNoteAction
        lang={lang}
        teams={shared.teams}
        // A team note is not shared again; from here it is only opened.
        open={isSharedNote(note) ? () => navigate('teams') : undefined}
        share={(teamId) => shareToTeam(note, teamId, null)}
        onDone={close}
      />
    );
  }, [teamsClient, shared.teams, lang, navigate, shareToTeam]);

  /** What the Library's folder view may do to teams' notes and folders. */
  const teamActions = useMemo<TeamLibraryActions | null>(() => {
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN || !teamsClient) return null;
    const client = teamsClient;
    /** After a change: pull the team's changes, then read what is held. */
    const settle = async (teamId: string) => {
      await client.cache('sync', teamId);
      await loadShared();
    };
    const refused = (result: { ok: true } | { ok: false; error: string }) => {
      if (!result.ok) throw new Failure(result.error);
    };
    return {
      share: async (noteId, teamId, folderId) => {
        const note = notes?.find((n) => n.id === noteId);
        if (note) await shareToTeam(note, teamId, folderId);
      },
      file: async (noteId, teamId, folderId) => {
        const note = shared.notes.find((n) => n.id === noteId && n.team?.id === teamId);
        if (!note?.team || note.team.folderId === folderId) return;
        refused(
          await client.request('notes.update', {
            teamId,
            noteId,
            version: note.team.version,
            folderId,
          }),
        );
        await settle(teamId);
      },
      createFolder: async (teamId, name, parentId) => {
        refused(await client.request('folders.create', { teamId, name, parentId }));
        await settle(teamId);
      },
      renameFolder: async (teamId, folderId, name) => {
        refused(await client.request('folders.rename', { teamId, folderId, name }));
        await settle(teamId);
      },
      deleteFolder: async (teamId, folderId) => {
        refused(await client.request('folders.delete', { teamId, folderId }));
        await settle(teamId);
      },
    };
  }, [teamsClient, notes, shared.notes, shareToTeam, loadShared]);

  /** The "Discuss" link on a team note's row: to that note's own page in Teams. */
  const discussAction = useMemo<DiscussAction | null>(() => {
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return null;
    if (!teamsClient) return null;
    return {
      label: getTeamsStrings(lang).discuss,
      open: (note) => {
        if (note.team) navigate('teams', { page: 'note', teamId: note.team.id, noteId: note.id });
      },
    };
  }, [teamsClient, lang, navigate]);

  const lastSeenMention = prefs?.teams.lastSeenMentionId ?? null;
  /** Somebody named this reader since they last looked at Mentions. */
  const mentionsUnseen = newestMention !== null && newestMention !== lastSeenMention;

  function content() {
    if (import.meta.env.WXT_TEAMS_API_ORIGIN && view === 'teams' && teamsClient) {
      return (
        <TeamsView
          lang={lang}
          client={teamsClient}
          onOpenSettings={() => navigate('settings')}
          onOpenPlan={() => navigate('settings', OVERVIEW, 'plan')}
          onOpenLibrary={(next) => {
            setOwner(next);
            navigate('library');
          }}
          personal={personalNotes}
          route={place.teams}
          onRoute={(teams) => navigate('teams', teams)}
        />
      );
    }
    if (import.meta.env.WXT_TEAMS_API_ORIGIN && view === 'mentions' && teamsClient) {
      return (
        <Page>
          <PageHeader title={getTeamsStrings(lang).mentionsTitle} />
          <MentionsInbox
            lang={lang}
            client={teamsClient}
            onOpenNote={(teamId, noteId) => navigate('teams', { page: 'note', teamId, noteId })}
            onRead={(commentId) => void prefsRepo.setLastSeenMention(commentId)}
          />
        </Page>
      );
    }
    if (view === 'whats-new') {
      return (
        <WhatsNewView
          strings={strings}
          lang={lang}
          currentVersion={currentVersion}
          lastSeenVersion={lastSeenVersion ?? null}
        />
      );
    }
    if (view === 'settings') {
      return (
        <LibrarySettingsView
          strings={strings}
          lang={lang}
          preferences={preferences}
          backup={{ onExport: handleExportBackup, onImport: handleImportBackup }}
          teams={teamsClient}
          focus={place.focus}
          onOpenTeam={() => navigate('teams')}
        />
      );
    }
    return (
      <LibraryView
        strings={strings}
        lang={lang}
        focusNoteId={place.note}
        notes={notes}
        teamNotes={shared.notes}
        teams={shared.teams}
        teamFolders={shared.folders}
        teamActions={teamActions}
        folders={folders}
        owner={owner}
        onOwnerChange={setOwner}
        onCreateFolder={(name, parentId) => createFolder({ name, parentId })}
        onRenameFolder={(folderId, name) => foldersRepo.rename(folderId, name)}
        onDeleteFolder={deleteFolder}
        onMoveNote={noteActions.move}
        onOpenSettings={() => navigate('settings')}
      />
    );
  }

  if (import.meta.env.WXT_TEAMS_API_ORIGIN && panelPlace && teamsClient) {
    return (
      <div ref={scopeRef} className="hm-scope hm-panel-page" dir={dir} data-hm-theme={theme}>
        <PanelView
          lang={lang}
          client={teamsClient}
          teamId={panelPlace.teamId}
          noteId={panelPlace.noteId}
          pageKey={panelPlace.pageKey}
        />
      </div>
    );
  }

  return (
    <NoteActionsContext.Provider value={noteActions}>
      <NoteShareSlot.Provider value={shareAction}>
        <NoteDiscussSlot.Provider value={discussAction}>
          <div ref={scopeRef} className="hm-scope hm-notes-page" dir={dir} data-hm-theme={theme}>
            <Sidebar
              view={view}
              lang={lang}
              strings={strings}
              // Teams keeps the team the reader was on, so leaving for the Library
              // and coming back does not put them on a different one.
              onNavigate={(next) =>
                navigate(next, { page: 'overview', teamId: place.teams.teamId })
              }
              whatsNewUnseen={lastSeenVersion !== undefined && hasUnseenReleases(lastSeenVersion)}
              showTeams={teamsClient !== null}
              mentionsUnseen={mentionsUnseen}
            />
            {content()}
            {/* Inside the scope, so the dialog wears Hamesh's tokens even though
                the browser lifts it to the top layer. */}
            {import.meta.env.WXT_TEAMS_API_ORIGIN && consent && (
              <ShareConsent
                lang={lang}
                teamName={consent.teamName}
                onAnswer={(share, dontAskAgain) => {
                  if (share && dontAskAgain) void prefsRepo.setSkipShareConsent(true);
                  consent.answer(share);
                  setConsent(null);
                }}
              />
            )}
          </div>
        </NoteDiscussSlot.Provider>
      </NoteShareSlot.Provider>
    </NoteActionsContext.Provider>
  );
}

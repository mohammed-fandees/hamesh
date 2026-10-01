import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { CachedFolder } from '@/teams/sync-store';
import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';
import { readPageNotes, watchPageNotes } from '@/teams/page-cache';
import { relativeTime } from '../format';
import { getStrings, type Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { EmptyState } from '../kit/EmptyState';
import { OpenElsewhereIcon } from '../kit/icons';
import { InlineError } from '../kit/Feedback';
import { InlineConfirm } from '../kit/InlineConfirm';
import { MarginMark } from '../kit/MarginMark';
import { SegmentedControl } from '../kit/SegmentedControl';
import { Skeleton } from '../kit/Skeleton';
import { NoteMenu } from '../NoteMenu';
import { CommentThread } from './CommentThread';
import { noteRights } from './permissions';
import { routeToParams } from './route';
import { getTeamsStrings } from './strings';
import './styles';
import { useTeams } from './useTeams';

type PanelMode = 'note' | 'page';

interface PanelViewProps {
  lang: Lang;
  client: TeamsClient;
  /** The note the panel was opened on, if any. */
  teamId: string | null;
  noteId: string | null;
  /** The page it was opened beside — what "Whole page" lists. */
  pageKey: string | null;
}

/**
 * Hamesh in Chrome's side panel, beside the page a shared note is on: that
 * note's whole discussion — naming people with @ included — or every shared
 * note on the page.
 *
 * It is one of Hamesh's own pages, so it asks the worker like any other; the
 * web page beside it is never handed the session or the discussion. The page's
 * shared notes are read from what the worker already cached for it.
 */
export function PanelView({ lang, client, teamId, noteId, pageKey }: PanelViewProps) {
  const strings = getTeamsStrings(lang);
  const common = getStrings(lang);
  const page = useTeams(client);
  const [asking, setAsking] = useState(false);
  const [pageNotes, setPageNotes] = useState<Note[] | null>(null);
  const [selected, setSelected] = useState(teamId && noteId ? { teamId, noteId } : null);
  const [mode, setMode] = useState<PanelMode>(selected ? 'note' : 'page');
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [folders, setFolders] = useState<CachedFolder[]>([]);

  // The page's shared notes, from the worker's cache — no request — and again
  // whenever the worker rewrites them (a note shared, edited or deleted).
  useEffect(() => {
    if (!pageKey) return;
    let cancelled = false;
    const load = () =>
      void readPageNotes(pageKey).then((notes) => {
        if (!cancelled) setPageNotes(notes);
      });
    load();
    const unwatch = watchPageNotes(pageKey, load);
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [pageKey]);

  /** The note's own page in Hamesh's Library, where the whole of it lives. */
  function openInHamesh(where: { teamId: string; noteId: string }) {
    const params = new URLSearchParams({
      view: 'teams',
      ...routeToParams({ page: 'note', teamId: where.teamId, noteId: where.noteId }),
    });
    void browser.tabs.create({
      url: browser.runtime.getURL(`/notes.html?${params}` as '/notes.html'),
    });
  }

  async function remove(where: { teamId: string; noteId: string }) {
    const gone = await page.run('notes.delete', where, 'note.delete');
    setAsking(false);
    if (gone === null) return;
    setPageNotes((notes) => notes?.filter((n) => n.id !== where.noteId) ?? null);
    setSelected(null);
    setMode('page');
  }

  // The selected note's team and who is in it: what the discussion needs —
  // asked only once the worker says there is a session to ask with.
  const signedIn = page.status?.state === 'signed_in';
  const selectedTeam = signedIn ? (selected?.teamId ?? null) : null;
  useEffect(() => {
    if (!selectedTeam) return;
    let cancelled = false;
    void (async () => {
      const [t, m, held] = await Promise.all([
        page.run('team.get', { teamId: selectedTeam }),
        page.run('members.list', { teamId: selectedTeam }),
        // The team's folders, as this device holds them — to say which one.
        page.cache(selectedTeam),
      ]);
      if (cancelled) return;
      setTeam(t);
      setMembers(m?.members ?? null);
      setFolders(held?.folders ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // `page` is rebuilt on every render; the team is what decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam]);

  const personOf = (userId: string | null) =>
    userId ? members?.find((m) => m.userId === userId) : undefined;
  const note = selected
    ? pageNotes?.find((n) => n.id === selected.noteId && n.team?.id === selected.teamId)
    : undefined;

  function body() {
    if (page.status && page.status.state !== 'signed_in') {
      return (
        <EmptyState size="inline" title={strings.signedOutTitle} body={strings.signedOutBody} />
      );
    }
    if (mode === 'page') {
      if (!pageKey)
        return (
          <EmptyState size="inline" title={strings.panelEmptyTitle} body={strings.panelEmptyBody} />
        );
      if (pageNotes === null) return <Skeleton rows={2} />;
      if (pageNotes.length === 0) {
        return <EmptyState size="inline" title={strings.panelNoneHere} />;
      }
      return (
        <ul className="hm-panel-notes">
          {pageNotes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="hm-panel-notes__item"
                onClick={() => {
                  setSelected({ teamId: n.team!.id, noteId: n.id });
                  setMode('note');
                }}
              >
                <span className="hm-panel-notes__team">
                  <bdi>{n.team?.name}</bdi> · {relativeTime(n.updatedAt, lang)}
                </span>
                <span className="hm-panel-notes__body hm-prose" dir="auto">
                  {n.content}
                </span>
              </button>
            </li>
          ))}
        </ul>
      );
    }
    if (!selected) {
      return (
        <EmptyState size="inline" title={strings.panelEmptyTitle} body={strings.panelEmptyBody} />
      );
    }
    if (!team || !page.me) return <Skeleton rows={2} />;
    const author = personOf(note?.team?.authorId ?? null);
    const rights = noteRights(team, note?.team?.authorId ?? null, page.me.user.id);
    const folder = folders.find((f) => f.id === note?.team?.folderId);
    return (
      <>
        {note && (
          <article className="hm-panel-note">
            <header className="hm-panel-note__head">
              <Avatar
                name={author?.displayName ?? null}
                src={author?.avatarUrl}
                seed={note.team?.authorId}
              />
              <span className="hm-panel-note__who">
                <bdi className="hm-panel-note__author">
                  {author?.displayName ?? strings.formerMember}
                </bdi>
                <span className="hm-panel-note__meta">
                  <bdi className="hm-panel-note__team">{team.team.name}</bdi>
                  {folder && (
                    <>
                      {' · '}
                      <bdi>{folder.name}</bdi>
                    </>
                  )}
                  {' · '}
                  {relativeTime(note.updatedAt, lang)}
                </span>
              </span>
              <NoteMenu
                strings={common}
                text={note.content}
                onOpenInHamesh={() => openInHamesh(selected)}
                onDelete={rights.delete ? () => setAsking(true) : undefined}
              />
            </header>
            {note.anchor.type === 'text' && (
              <blockquote className="hm-panel-note__quote" dir="auto">
                «{note.anchor.exact}»
              </blockquote>
            )}
            <p className="hm-panel-note__body hm-prose" dir="auto">
              {note.content}
            </p>
            {asking && (
              <InlineConfirm
                question={strings.deleteSharedConfirm}
                confirmLabel={common.delete}
                cancelLabel={common.keepIt}
                working={page.working('note.delete')}
                onConfirm={() => void remove(selected)}
                onCancel={() => setAsking(false)}
              />
            )}
            {page.failed('note.delete') && (
              <InlineError>{strings.error(page.failed('note.delete')!)}</InlineError>
            )}
            <button
              type="button"
              className="hm-panel-note__open"
              onClick={() => openInHamesh(selected)}
            >
              <OpenElsewhereIcon />
              {strings.discussionInLibrary}
            </button>
          </article>
        )}
        <CommentThread
          strings={strings}
          lang={lang}
          page={page}
          team={team}
          noteId={selected.noteId}
          myUserId={page.me.user.id}
          members={members}
          variant="panel"
        />
      </>
    );
  }

  return (
    <div className="hm-panel-view">
      <header className="hm-panel-view__head">
        <MarginMark size={16} strokeWidth={3.5} className="hm-mark" />
        <span className="hm-panel-view__brand">{strings.brand}</span>
        <SegmentedControl<PanelMode>
          value={mode}
          name="hm-panel-mode"
          groupLabel={strings.panelShow}
          options={[
            { value: 'note', label: strings.panelThisNote },
            { value: 'page', label: strings.panelWholePage(pageNotes?.length ?? 0) },
          ]}
          onChange={setMode}
        />
      </header>
      <div className="hm-panel-view__body">{body()}</div>
    </div>
  );
}

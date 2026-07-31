import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { Note, ElementAnchor, VideoAnchor } from '@/domain/note';
import { buildElementAnchor } from '@/domain/anchor';
import { buildVideoAnchor } from '@/domain/video-anchor';
import { resolveAnchor, resolveVideoAnchor, ResolutionQuality } from '@/domain/anchor-resolution';
import { computeMarkerX, formatVideoTimestamp } from '@/domain/video-markers';
import { generatePageKey } from '@/domain/page-key';
import { getDeepestEligibleElement } from '@/utils/dom';
import { onNavigationChange } from '@/content/navigation';
import { detectHostTheme, type HostTheme } from '@/content/theme';
import type { AppearanceMode } from '@/domain/preferences';
import { useFloating, useFloatingAbove, type AnchorRect } from '@/content/useFloating';
import { getVideoAdapters, getActiveAdapterMatch } from '@/content/video-adapters/registry';
import type { VideoPlayerAdapter } from '@/content/video-adapters/types';
import type { AdapterVideoMatch } from '@/content/video-adapters/registry';
import { trackVideoContext, getActiveVideoMatchUnderInteraction } from '@/content/video-context';
import { Composer } from '@/ui/Composer';
import { NoteViewer } from '@/ui/NoteViewer';
import { Marker } from '@/ui/Marker';
import { SelectionHint } from '@/ui/SelectionHint';
import { VideoQuickNote } from '@/ui/video/VideoQuickNote';
import { VideoMarker } from '@/ui/video/VideoMarker';
import { getStrings, dirForLang, type Lang, type Strings } from '@/ui/i18n';

interface Resolved {
  note: Note;
  element: Element | null;
  quality: ResolutionQuality;
}

interface VideoResolved {
  note: Note;
  video: HTMLVideoElement | null;
  quality: ResolutionQuality;
}

interface VideoMarkerItem {
  note: Note;
  anchor: VideoAnchor;
  top: number;
  left: number;
}

/** Half-width/height (px) of the click-detection zone around a marker's
 *  center — generous relative to the 8px dot itself, since markers are
 *  `pointer-events: none` (see the click handler below for why) and so
 *  aren't hit-tested by the browser at all; this radius is the only
 *  "clickable size" they have. */
const VIDEO_MARKER_HIT_RADIUS = 10;

interface HameshAppProps {
  repo: NotesRepository;
  prefsRepo: PreferencesRepository;
  /** The language to render before the stored preference (if any) has
   *  loaded — already resolved from the browser's UI language, so this is
   *  exactly today's behavior for users with no saved choice. */
  initialLang: Lang;
  /** Imperatively toggles selection mode; wired to the content-script controller. */
  registerActivate: (fn: () => void) => void;
  /** Imperatively restores (scrolls to, highlights, opens) a specific note by
   *  id — wired to the content-script controller's `RESTORE_NOTE` handler,
   *  which fires from the Notes Library's Open Note flow. */
  registerRestoreNote: (fn: (noteId: string) => void) => void;
}

function toAnchorRect(el: Element): AnchorRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

interface RailPlacement {
  left: number;
  width: number;
  top: number;
}

/** Where to draw the timeline rail: a native-timeline adapter (YouTube)
 *  aligns to the site's own progress-bar rect; otherwise Hamesh's own rail
 *  overlaps the video element's own bottom edge (a few px *inside* it, not
 *  below) — see PR3's plan for why a generic `<video>` can never get
 *  pixel-perfect native placement (browsers don't expose native
 *  `<video controls>` scrubber DOM at all). Placing it below the video
 *  instead would put every marker's hoverable area outside the video's own
 *  hover region — moving the pointer down to click one would cross that
 *  boundary and trigger `areControlsVisible`'s hide-on-mouseleave before
 *  the click lands. Overlapping the frame keeps markers inside the same
 *  hover region the whole approach, which also happens to match how most
 *  custom players place their own control bar. */
function getRailPlacement(
  adapter: VideoPlayerAdapter,
  video: HTMLVideoElement,
): RailPlacement | null {
  if (adapter.capabilities.nativeTimeline) {
    const rect = adapter.getTimelineRect(video);
    if (!rect || rect.width === 0) return null;
    return { left: rect.left, width: rect.width, top: rect.top + rect.height / 2 };
  }
  const rect = video.getBoundingClientRect();
  if (rect.width === 0) return null;
  return { left: rect.left, width: rect.width, top: rect.bottom - 6 };
}

/** Coalesced viewport frame counter — bumps on scroll/resize while `active`. */
function useViewportFrame(active: boolean): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const onChange = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setFrame((f) => f + 1);
      });
    };
    window.addEventListener('scroll', onChange, { passive: true, capture: true });
    window.addEventListener('resize', onChange, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onChange, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener('resize', onChange);
    };
  }, [active]);
  return frame;
}

export function HameshApp({
  repo,
  prefsRepo,
  initialLang,
  registerActivate,
  registerRestoreNote,
}: HameshAppProps) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [appearance, setAppearance] = useState<AppearanceMode>('match-website');
  const strings = getStrings(lang);
  const dir = dirForLang(lang);

  // Load stored preferences (if any) and stay subscribed for changes made
  // elsewhere — the popup's Settings screen, or another tab. `storage.watch`
  // is backed by `chrome.storage.onChanged`, which already broadcasts to
  // every extension context, so no custom messaging is needed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await prefsRepo.get();
      if (!cancelled) {
        setLang(prefs.language ?? initialLang);
        setAppearance(prefs.appearance);
      }
    })();
    const unwatch = prefsRepo.watch((prefs) => {
      setLang(prefs.language ?? initialLang);
      setAppearance(prefs.appearance);
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [prefsRepo, initialLang]);

  // `hostTheme` is always kept up to date regardless of `appearance`, so
  // switching back to "Match website" is instant rather than needing a
  // fresh detection pass.
  const [hostTheme, setHostTheme] = useState<HostTheme>(() => detectHostTheme());
  const theme: HostTheme =
    appearance === 'light' ? 'light' : appearance === 'dark' ? 'dark' : hostTheme;

  // Re-detect on host-side theme changes while "Match website" is active:
  // a class/style change on <html>/<body> (dark-mode toggles, theme CSS that
  // loads asynchronously) or an OS-level scheme change (for pages that key
  // off prefers-color-scheme with no explicit background of their own).
  // Scoped to attribute changes only — cheap, and doesn't fire on ordinary
  // content mutations (that's the separate anchor-resolution observer below).
  useEffect(() => {
    if (appearance !== 'match-website') return;
    let timer = 0;
    const recheck = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setHostTheme(detectHostTheme()), 200);
    };
    const observer = new MutationObserver(recheck);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', recheck);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      media?.removeEventListener('change', recheck);
    };
  }, [appearance]);

  const [pageKey, setPageKey] = useState(() => generatePageKey(location.href));
  const [notes, setNotes] = useState<Note[]>([]);
  const [resolved, setResolved] = useState<Resolved[]>([]);

  const [selecting, setSelecting] = useState(false);
  const [hover, setHover] = useState<{ rect: AnchorRect; x: number; y: number } | null>(null);

  const [composer, setComposer] = useState<{ element: Element; anchor: ElementAnchor } | null>(
    null,
  );
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Video notes ----
  const [videoResolved, setVideoResolved] = useState<VideoResolved[]>([]);
  // The page's currently-matched adapter + active video, if any — checked
  // once synchronously at mount via a lazy initializer (same pattern as
  // `hostTheme` above: the DOM is already present by the time this content
  // script runs, so there's nothing to wait for), then refreshed on
  // navigation and as the DOM settles (below) — "which video is active"
  // changes far less often than scroll position.
  const [videoMatch, setVideoMatch] = useState<AdapterVideoMatch | null>(() =>
    getActiveAdapterMatch(),
  );
  const [videoComposer, setVideoComposer] = useState<AdapterVideoMatch | null>(null);
  // Bumped by the active video's loadedmetadata/durationchange — its
  // duration is frequently unknown at mount time, so marker x-positions
  // need a reason to recompute once it becomes available.
  const [videoTick, setVideoTick] = useState(0);
  // Whether the active video's own controls (native or the site's) are
  // currently visible — timeline markers hide when this is false, so they
  // don't linger over a video whose own chrome has faded away. See each
  // adapter's `areControlsVisible` for how this is actually determined.
  const [videoControlsVisible, setVideoControlsVisible] = useState(true);
  // Tracks which `videoMatch` `videoControlsVisible` was last computed for,
  // so a change in the active video re-seeds it synchronously during render
  // (React's documented "adjust state when a prop changes" pattern — see
  // `pendingRestoreId`/`restoredFor` below for the same technique) rather
  // than via a direct setState call in an effect body.
  const [controlsVisibleFor, setControlsVisibleFor] = useState<AdapterVideoMatch | null>(null);
  if (videoMatch !== controlsVisibleFor) {
    setControlsVisibleFor(videoMatch);
    setVideoControlsVisible(
      videoMatch ? videoMatch.adapter.areControlsVisible(videoMatch.video) : true,
    );
  }

  // ---- Open Note flow: restore a specific note by id once it resolves ----
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<Note[]>([]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Read by the coordinate-based click handler below (registered once, not
  // per-render) so it always sees current marker positions/the active video
  // without needing to re-subscribe on every scroll-driven recompute.
  const videoMarkerItemsRef = useRef<VideoMarkerItem[]>([]);
  const videoMatchRef = useRef<AdapterVideoMatch | null>(null);
  useEffect(() => {
    videoMatchRef.current = videoMatch;
  }, [videoMatch]);

  const hasFloating =
    notes.length > 0 || composer !== null || viewerId !== null || videoComposer !== null;
  const frame = useViewportFrame(hasFloating || selecting);

  // ---- Load + resolve notes for the current page ----
  const resolveAll = useCallback((list: Note[]) => {
    setResolved(
      list.map((note) => {
        const r = resolveAnchor(note);
        return { note, element: r.element, quality: r.quality };
      }),
    );
  }, []);

  // Runs across the same unified `notes` list as `resolveAll` — element
  // notes just resolve Unresolved here (and vice versa in `resolveAll`),
  // rather than filtering the list twice by anchor type.
  const resolveAllVideo = useCallback((list: Note[]) => {
    const adapters = getVideoAdapters();
    setVideoResolved(
      list.map((note) => {
        const r = resolveVideoAnchor(note, adapters);
        return { note, video: r.element as HTMLVideoElement | null, quality: r.quality };
      }),
    );
  }, []);

  const refreshVideoMatch = useCallback(() => {
    setVideoMatch(getActiveAdapterMatch());
  }, []);

  /** Commit a new notes list to both state slices (avoids nested setState). */
  const commitNotes = useCallback(
    (next: Note[]) => {
      notesRef.current = next;
      setNotes(next);
      resolveAll(next);
      resolveAllVideo(next);
    },
    [resolveAll, resolveAllVideo],
  );

  const loadNotes = useCallback(async () => {
    // pageKey state is seeded by the initializer and updated by the nav handler;
    // here we just read the live URL so a load always fetches the current page.
    const key = generatePageKey(location.href);
    try {
      const list = await repo.getForPage(key);
      commitNotes(list);
    } catch {
      commitNotes([]);
    }
  }, [repo, commitNotes]);

  // Initial load. The fetch is awaited inline so state is only set afterwards.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await repo.getForPage(generatePageKey(location.href));
        if (!cancelled) commitNotes(list);
      } catch {
        if (!cancelled) commitNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, commitNotes]);

  // ---- SPA navigation: reload for the new effective page ----
  useEffect(() => {
    return onNavigationChange(() => {
      const key = generatePageKey(location.href);
      setPageKey((prev) => {
        if (prev !== key) {
          setComposer(null);
          setViewerId(null);
          setVideoComposer(null);
        }
        return key;
      });
      setHostTheme(detectHostTheme());
      refreshVideoMatch();
      loadNotes();
    });
  }, [loadNotes, refreshVideoMatch]);

  // ---- Debounced re-resolution as the DOM settles (dynamic content) ----
  // Also re-checks the active video-adapter match — a heavy SPA (YouTube)
  // can swap its player DOM (a different <video>, or one that didn't exist
  // yet at mount) without a `popstate`/`hashchange`/pushState navigation
  // this content script would otherwise notice. Kept unconditional (not
  // gated on `notes.length`, unlike before video notes existed) since
  // detecting "is there a video here now" doesn't depend on any notes
  // already existing on the page.
  useEffect(() => {
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        resolveAll(notes);
        resolveAllVideo(notes);
        refreshVideoMatch();
      }, 400);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [notes, resolveAll, resolveAllVideo, refreshVideoMatch]);

  // ---- Alt+H context tracking (hover/focus over the active video) ----
  useEffect(() => trackVideoContext(), []);

  // Re-place markers once the active video's duration becomes known
  // (frequently unavailable at mount — `loadedmetadata`/`durationchange`
  // fire asynchronously) or changes (a fresh video swapped in by the site).
  useEffect(() => {
    const video = videoMatch?.video;
    if (!video) return;
    const bump = () => setVideoTick((t) => t + 1);
    video.addEventListener('loadedmetadata', bump);
    video.addEventListener('durationchange', bump);
    return () => {
      video.removeEventListener('loadedmetadata', bump);
      video.removeEventListener('durationchange', bump);
    };
  }, [videoMatch]);

  // Keeps `videoControlsVisible` current after the initial value seeded
  // above: recomputes on the handful of real signals that actually drive
  // it — pointer entering/leaving/moving over the video (the html5-generic
  // heuristic) and play/pause (both adapters), plus a MutationObserver on
  // the player container's `class` attribute (YouTube toggles
  // `.ytp-autohide` there — see youtube.ts). Some of these are no-ops for
  // a given adapter; cheap enough not to bother branching per-adapter here.
  useEffect(() => {
    if (!videoMatch) return;
    const { adapter, video } = videoMatch;
    const recompute = () => setVideoControlsVisible(adapter.areControlsVisible(video));

    video.addEventListener('mouseenter', recompute);
    video.addEventListener('mouseleave', recompute);
    video.addEventListener('mousemove', recompute);
    video.addEventListener('play', recompute);
    video.addEventListener('pause', recompute);

    const container = adapter.getPlayerContainer(video);
    const observer = new MutationObserver(recompute);
    if (container) {
      observer.observe(container, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      video.removeEventListener('mouseenter', recompute);
      video.removeEventListener('mouseleave', recompute);
      video.removeEventListener('mousemove', recompute);
      video.removeEventListener('play', recompute);
      video.removeEventListener('pause', recompute);
      observer.disconnect();
    };
  }, [videoMatch]);

  // ---- Selection mode ----
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setHover(null);
  }, []);

  // Alt+H is one shortcut, context-aware: hovering/focused on the page's
  // video opens the quick video note; otherwise it's today's element
  // selection. See `video-context.ts` for the (heuristic, documented)
  // hover/focus check this branches on.
  const activate = useCallback(() => {
    const match = getActiveVideoMatchUnderInteraction();
    if (match) {
      setViewerId(null);
      setComposer(null);
      setSelecting(false);
      setVideoComposer(match);
      return;
    }
    setViewerId(null);
    setComposer(null);
    setVideoComposer(null);
    setSelecting(true);
  }, []);

  useEffect(() => registerActivate(activate), [registerActivate, activate]);

  useEffect(
    () => registerRestoreNote((noteId) => setPendingRestoreId(noteId)),
    [registerRestoreNote],
  );

  // Adjusts state as soon as the pending restore target appears in
  // `resolved` — React's documented pattern for reacting to a dependency
  // change during render rather than in an Effect (see "You Might Not Need
  // an Effect"). `pendingRestoreId !== restoredFor` makes this
  // self-limiting: it only fires once per restore request, and if the note
  // hasn't loaded into `resolved` yet (RESTORE_NOTE can arrive before the
  // initial notes fetch finishes), it simply re-checks on the next render
  // that `resolved` changes on — no polling, no fixed delay.
  if (pendingRestoreId && pendingRestoreId !== restoredFor) {
    const target = resolved.find((r) => r.note.id === pendingRestoreId);
    if (target) {
      setRestoredFor(pendingRestoreId);
      setComposer(null);
      setError(null);
      setViewerId(pendingRestoreId);
      if (target.element) {
        setHighlightId(pendingRestoreId);
        setHighlightElement(target.element);
      }
    }
  }

  // The actual imperative side effect (scrolling), kept separate from the
  // state adjustment above and keyed on `highlightElement` specifically —
  // not `resolved`, which changes on every re-resolution pass (e.g. the
  // debounced MutationObserver below) and would otherwise re-trigger the
  // scroll and keep extending the highlight for as long as the page keeps
  // mutating.
  useEffect(() => {
    if (!highlightElement) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    highlightElement.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    // Mirrors the CSS animation duration in tokens.css (.hm-restore-highlight)
    // — this just unmounts the highlight overlay once that animation has
    // finished, not a readiness/timing guess.
    const timer = window.setTimeout(() => {
      setHighlightId(null);
      setHighlightElement(null);
    }, 1400);
    return () => clearTimeout(timer);
  }, [highlightElement]);

  // Escape exits selection mode
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopSelecting();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [selecting, stopSelecting]);

  const elementUnderCursor = useCallback((x: number, y: number): Element | null => {
    const capture = captureRef.current;
    const host = capture ? (capture.getRootNode() as ShadowRoot).host : null;
    // Make the capture overlay transparent to hit-testing for this probe so
    // `elementFromPoint` returns the underlying host-page element. The shadow
    // host's own box is 0×0 (overlay), so with the overlay ignored the probe
    // sees straight through to the page.
    if (capture) capture.style.pointerEvents = 'none';
    const raw = document.elementFromPoint(x, y);
    if (capture) capture.style.pointerEvents = 'auto';
    if (!raw || raw === host) return null;
    return getDeepestEligibleElement(raw);
  }, []);

  const onCaptureMove = useCallback(
    (e: React.MouseEvent) => {
      const el = elementUnderCursor(e.clientX, e.clientY);
      if (!el) {
        setHover(null);
        return;
      }
      setHover({ rect: toAnchorRect(el), x: e.clientX, y: e.clientY });
    },
    [elementUnderCursor],
  );

  const onCaptureClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = elementUnderCursor(e.clientX, e.clientY);
      if (!el) return;
      setSelecting(false);
      setHover(null);
      setError(null);
      setComposer({ element: el, anchor: buildElementAnchor(el) });
    },
    [elementUnderCursor],
  );

  // ---- Persistence ----
  const handleSave = useCallback(
    async (content: string) => {
      if (!composer) return;
      setBusy(true);
      setError(null);
      try {
        const note = await repo.create({
          content,
          pageKey,
          originalUrl: location.href,
          anchor: composer.anchor,
          pageContext: document.title ? { title: document.title } : undefined,
        });
        setComposer(null);
        commitNotes([...notesRef.current, note]);
      } catch {
        setError(strings.saveError);
      } finally {
        setBusy(false);
      }
    },
    [composer, repo, pageKey, commitNotes, strings.saveError],
  );

  // No busy/error state, unlike `handleSave` — the quick-note popup has no
  // UI for either (spec: "extremely lightweight, never interrupt
  // watching"). A failed save is dropped silently, same as a cancel; a
  // persistent storage failure would already be visible via element notes.
  const handleSaveVideoNote = useCallback(
    async (content: string) => {
      if (!videoComposer) return;
      const anchor = buildVideoAnchor(videoComposer.video, videoComposer.adapter);
      setVideoComposer(null);
      if (!anchor) return;
      try {
        const note = await repo.create({
          content,
          pageKey,
          originalUrl: location.href,
          anchor,
          pageContext: document.title ? { title: document.title } : undefined,
        });
        commitNotes([...notesRef.current, note]);
      } catch {
        /* dropped — see comment above */
      }
    },
    [videoComposer, repo, pageKey, commitNotes],
  );

  const handleUpdate = useCallback(
    async (noteId: string, content: string) => {
      setBusy(true);
      setError(null);
      try {
        const updated = await repo.update(noteId, pageKey, { content });
        if (updated) {
          commitNotes(notesRef.current.map((n) => (n.id === noteId ? updated : n)));
        }
      } catch {
        setError(strings.saveError);
      } finally {
        setBusy(false);
      }
    },
    [repo, pageKey, commitNotes, strings.saveError],
  );

  // Pinning is a metadata toggle, not a save — deliberately doesn't touch
  // `busy`/`error` the way create/update/delete do, so it stays instant
  // rather than showing a saving state for something this quick.
  const handleTogglePin = useCallback(
    async (noteId: string) => {
      const current = notesRef.current.find((n) => n.id === noteId);
      if (!current) return;
      try {
        const updated = await repo.setPinned(noteId, pageKey, !current.pinned);
        if (updated) {
          commitNotes(notesRef.current.map((n) => (n.id === noteId ? updated : n)));
        }
      } catch {
        setError(strings.saveError);
      }
    },
    [repo, pageKey, commitNotes, strings.saveError],
  );

  const handleDelete = useCallback(
    async (noteId: string) => {
      setBusy(true);
      try {
        await repo.delete(noteId, pageKey);
        setViewerId(null);
        commitNotes(notesRef.current.filter((n) => n.id !== noteId));
      } catch {
        setError(strings.saveError);
      } finally {
        setBusy(false);
      }
    },
    [repo, pageKey, commitNotes, strings.saveError],
  );

  // ---- Outside-click closes composer / viewer (non-modal) ----
  useEffect(() => {
    if (!composer && !viewerId && !videoComposer) return;
    const onDown = (e: Event) => {
      const path = e.composedPath();
      const insideCard = path.some(
        (n) => n instanceof HTMLElement && n.classList?.contains('hm-card'),
      );
      const onMarker = path.some(
        (n) => n instanceof HTMLElement && n.classList?.contains('hm-marker'),
      );
      if (!insideCard && !onMarker) {
        setComposer(null);
        setViewerId(null);
        setVideoComposer(null);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [composer, viewerId, videoComposer]);

  // ---- Derived: marker placements ----
  const markerItems = useMemo(() => {
    void frame; // recompute positions each viewport frame
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const perElement = new Map<Element, number>();
    const items: {
      note: Note;
      element: Element;
      top: number;
      left: number;
    }[] = [];
    for (const r of resolved) {
      if (!r.element) continue;
      const rect = r.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue;
      const idx = perElement.get(r.element) ?? 0;
      perElement.set(r.element, idx + 1);
      const top = Math.max(2, rect.top + idx * 30);
      let left =
        dir === 'rtl'
          ? Math.min(vw - 26, rect.right + 2)
          : rect.left - 26 < 2
            ? rect.left + 2
            : rect.left - 26;
      left = Math.max(2, left);
      items.push({ note: r.note, element: r.element, top, left });
    }
    return items;
  }, [resolved, dir, frame]);

  // ---- Derived: video marker placements ----
  const videoMarkerItems = useMemo(() => {
    void frame; // recompute the rail's position each viewport frame
    void videoTick; // recompute once duration is known/changes
    if (!videoMatch) return [];
    const placement = getRailPlacement(videoMatch.adapter, videoMatch.video);
    if (!placement) return [];
    const liveDuration = videoMatch.video.duration;
    const items: VideoMarkerItem[] = [];
    for (const r of videoResolved) {
      if (r.quality !== ResolutionQuality.Exact) continue;
      if (r.note.anchor.type !== 'video') continue;
      const anchor = r.note.anchor;
      const duration =
        Number.isFinite(liveDuration) && liveDuration > 0 ? liveDuration : (anchor.duration ?? 0);
      const left = computeMarkerX(anchor.timestamp, duration, {
        left: placement.left,
        width: placement.width,
      });
      items.push({ note: r.note, anchor, top: placement.top, left });
    }
    return items;
  }, [videoMatch, videoResolved, frame, videoTick]);

  // Mirrors the actually-rendered (i.e. visibility-gated) markers, since
  // the click handler below must not seek to a marker that isn't currently
  // shown (see the `videoControlsVisible` render gate further down).
  useEffect(() => {
    videoMarkerItemsRef.current = videoControlsVisible ? videoMarkerItems : [];
  }, [videoMarkerItems, videoControlsVisible]);

  // ---- Video marker clicks: coordinate-based, not real DOM hit-testing ----
  // Markers render with `pointer-events: none` (see the render below) —
  // deliberately not hit-testable by the browser at all. A real, on-top,
  // pointer-events:auto marker sitting over a video steals mouse hover from
  // the actual player element beneath it: from YouTube's own perspective
  // (or the browser's, for a native `<video controls>` scrubber) the
  // pointer has left the player entirely the instant it's over our marker,
  // which immediately hides *their* controls too — a real flicker bug, not
  // just a cosmetic one, and it also broke `html5-generic.ts`'s own
  // hover-based `areControlsVisible` heuristic the same way. Detecting
  // clicks by coordinate proximity instead lets real pointer events pass
  // straight through to the player underneath, so its own hover tracking
  // (and ours) stays correct. Registered once (not per-render) and reads
  // current state from refs, since marker positions change on every
  // scroll-driven recompute and this shouldn't re-subscribe that often.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const items = videoMarkerItemsRef.current;
      if (items.length === 0) return;
      let closest: VideoMarkerItem | null = null;
      let closestDist = Infinity;
      for (const item of items) {
        const dx = e.clientX - item.left;
        const dy = e.clientY - item.top;
        const dist = Math.hypot(dx, dy);
        if (dist <= VIDEO_MARKER_HIT_RADIUS && dist < closestDist) {
          closest = item;
          closestDist = dist;
        }
      }
      if (!closest) return;
      // Preempt the underlying player's own click-to-seek (YouTube's
      // scrubber, or a native <video controls> scrubber) so it doesn't
      // *also* seek — the whole reason markers overlap the player's own
      // hoverable/clickable region is to stay within its hover tracking,
      // which means a real click here also lands on whatever's beneath.
      e.preventDefault();
      e.stopPropagation();
      const video = videoMatchRef.current?.video;
      // Jump to the stored timestamp only — never call play()/pause(), so
      // a playing video keeps playing and a paused one stays paused (spec:
      // "Never unexpectedly autoplay").
      if (video) video.currentTime = closest.anchor.timestamp;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  // ---- Derived: transient highlight rect for the Open Note flow ----
  const highlightRect = useMemo(() => {
    void frame; // track the anchor element as the page scrolls into place
    if (!highlightId) return null;
    const target = resolved.find((r) => r.note.id === highlightId);
    if (!target?.element) return null;
    const rect = target.element.getBoundingClientRect();
    return {
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
    };
  }, [highlightId, resolved, frame]);

  const viewerNote = viewerId ? notes.find((n) => n.id === viewerId) : null;
  const viewerResolved = viewerId ? resolved.find((r) => r.note.id === viewerId) : null;

  return (
    <div className="hm-scope" data-hm-theme={theme} dir={dir}>
      {selecting && (
        <div
          ref={captureRef}
          className="hm-capture"
          onMouseMove={onCaptureMove}
          onClick={onCaptureClick}
        >
          {hover && (
            <div
              className="hm-hover-outline"
              style={{
                top: hover.rect.top - 4,
                left: hover.rect.left - 4,
                width: hover.rect.width + 8,
                height: hover.rect.height + 8,
              }}
            />
          )}
          {hover && (
            <SelectionHint text={strings.hint} style={{ top: hover.y + 18, left: hover.x + 14 }} />
          )}
        </div>
      )}

      {markerItems.map((m) => (
        <Marker
          key={m.note.id}
          label={strings.viewNote}
          flip={dir === 'rtl'}
          style={{ top: m.top, left: m.left, pointerEvents: 'auto' }}
          onOpen={() => {
            setComposer(null);
            setError(null);
            setViewerId(m.note.id);
          }}
        />
      ))}

      {videoControlsVisible &&
        videoMarkerItems.map((m) => (
          <VideoMarker
            key={m.note.id}
            label={strings.videoMarkerLabel(formatVideoTimestamp(m.anchor.timestamp))}
            // pointer-events stays 'none' (the .hm-scope default) — real
            // mouse clicks are handled by the coordinate-based listener
            // above, not by this element being hit-tested directly. This
            // still renders a real, focusable <button>, so Tab + Enter/
            // Space (keyboard activation dispatches a trusted click event
            // directly at the focused element, bypassing pointer
            // hit-testing entirely) keeps working.
            style={{ top: m.top, left: m.left }}
            onOpen={() => {
              if (videoMatch) videoMatch.video.currentTime = m.anchor.timestamp;
            }}
          />
        ))}

      {highlightRect && <div className="hm-restore-highlight" style={highlightRect} />}

      {composer && (
        <FloatingComposer
          element={composer.element}
          strings={strings}
          busy={busy}
          error={error}
          onSave={handleSave}
          onCancel={() => setComposer(null)}
        />
      )}

      {videoComposer && (
        <FloatingVideoQuickNote
          video={videoComposer.video}
          strings={strings}
          onSave={handleSaveVideoNote}
          onCancel={() => setVideoComposer(null)}
        />
      )}

      {viewerNote && (
        <FloatingViewer
          note={viewerNote}
          element={viewerResolved?.element ?? null}
          anchorAvailable={!!viewerResolved?.element}
          strings={strings}
          lang={lang}
          busy={busy}
          error={error}
          onUpdate={(content) => handleUpdate(viewerNote.id, content)}
          onDelete={() => handleDelete(viewerNote.id)}
          onTogglePin={() => handleTogglePin(viewerNote.id)}
          onClose={() => setViewerId(null)}
        />
      )}
    </div>
  );
}

function FloatingComposer({
  element,
  strings,
  busy,
  error,
  onSave,
  onCancel,
}: {
  element: Element;
  strings: Strings;
  busy: boolean;
  error: string | null;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const getRect = useCallback(() => toAnchorRect(element), [element]);
  const { cardRef, style } = useFloating(getRect);
  return (
    <div ref={cardRef} className="hm-floating" style={{ ...style, width: 300 }}>
      <Composer strings={strings} saving={busy} error={error} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

function FloatingVideoQuickNote({
  video,
  strings,
  onSave,
  onCancel,
}: {
  video: HTMLVideoElement;
  strings: Strings;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  // Anchored above the video (never below/over it — see useFloatingAbove),
  // not below-first like the element composer: a video can be most of the
  // viewport, so "just below the anchor's top edge" would sit on top of it.
  const getRect = useCallback(() => toAnchorRect(video), [video]);
  const { cardRef, style } = useFloatingAbove(getRect);
  return (
    <div ref={cardRef} className="hm-floating" style={style}>
      <VideoQuickNote
        placeholder={strings.videoQuickNotePlaceholder}
        label={strings.videoQuickNoteLabel}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}

function FloatingViewer({
  note,
  element,
  anchorAvailable,
  strings,
  lang,
  busy,
  error,
  onUpdate,
  onDelete,
  onTogglePin,
  onClose,
}: {
  note: Note;
  element: Element | null;
  anchorAvailable: boolean;
  strings: Strings;
  lang: Lang;
  busy: boolean;
  error: string | null;
  onUpdate: (content: string) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const getRect = useCallback((): AnchorRect | null => {
    if (element) return toAnchorRect(element);
    return {
      left: window.innerWidth / 2 - 150,
      top: window.innerHeight / 2 - 80,
      width: 0,
      height: 0,
    };
  }, [element]);
  const { cardRef, style } = useFloating(getRect);
  return (
    <div ref={cardRef} className="hm-floating" style={{ ...style, width: 300 }}>
      <NoteViewer
        note={note}
        strings={strings}
        lang={lang}
        anchorAvailable={anchorAvailable}
        saving={busy}
        error={error}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
        onClose={onClose}
      />
    </div>
  );
}

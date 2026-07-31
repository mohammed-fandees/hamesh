import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { Note, ElementAnchor, VideoAnchor } from '@/domain/note';
import { buildElementAnchor } from '@/domain/anchor';
import { buildVideoAnchor } from '@/domain/video-anchor';
import { resolveAnchor, resolveVideoAnchor, ResolutionQuality } from '@/domain/anchor-resolution';
import {
  computeMarkerX,
  clusterMarkers,
  formatVideoTimestamp,
  firstLineOf,
} from '@/domain/video-markers';
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
import { VideoMarkerPreview } from '@/ui/video/VideoMarkerPreview';
import { VideoMarkerCluster } from '@/ui/video/VideoMarkerCluster';
import {
  VideoMarkerClusterList,
  type VideoMarkerClusterItem,
} from '@/ui/video/VideoMarkerClusterList';
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

/** Half-width/height (px) of the click/hover-detection zone around a
 *  marker's center — generous relative to the 8px dot itself, since
 *  markers are `pointer-events: none` (see the click handler below for
 *  why) and so aren't hit-tested by the browser at all; this radius is
 *  the only "clickable/hoverable size" they have. */
const VIDEO_MARKER_HIT_RADIUS = 10;

/** Markers within this many px of each other (chained — see
 *  `clusterMarkers`) render as one cluster instead of overlapping dots. */
const VIDEO_CLUSTER_THRESHOLD_PX = 16;

/** One or more video notes at (roughly) the same rail position. `key` is
 *  stable for a given set of member notes (their ids, joined) — used both
 *  as the React list key and to match hover/open state against whichever
 *  group is currently under the pointer or expanded. */
interface VideoMarkerGroup {
  key: string;
  items: VideoMarkerItem[];
  top: number;
  left: number;
}

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
  // Docked just *below* the video's bottom edge, not overlapping it.
  // An earlier attempt placed this a few px *inside* the edge instead, to
  // keep markers within the video's own real-DOM hover region — but that
  // region is exactly where a native `<video controls>` scrubber lives,
  // and clicks landing there get consumed by the browser's own native
  // seek before a page-level `pointerdown` listener (any of them, capture
  // phase included) ever sees the event — confirmed with a throwaway
  // repro: clicks up to 70px above the video's bottom edge were silently
  // swallowed, only clicks in roughly the upper half of the video frame
  // reached `window`. Markers being briefly hard to "hover" via real
  // `:hover` because they now sit outside the video's box is mitigated
  // separately (see `effectiveVideoControlsVisible` below), and is a far
  // smaller problem than clicks not working at all.
  return { left: rect.left, width: rect.width, top: rect.bottom + 8 };
}

/** Fixed position for the hover preview/cluster hint, centered above a
 *  marker group's rail position and clamped into the viewport. Simpler
 *  than `useFloating`'s own-size-measuring approach — these are small,
 *  roughly fixed-size bubbles, so a static estimate is enough and avoids
 *  needing a forwarded ref through `VideoMarkerPreview`/`SelectionHint`. */
function videoHoverInfoStyle(group: VideoMarkerGroup): React.CSSProperties {
  const ESTIMATED_WIDTH = 200;
  const vw = window.innerWidth;
  const left = Math.max(8, Math.min(group.left - ESTIMATED_WIDTH / 2, vw - ESTIMATED_WIDTH - 8));
  return { position: 'fixed', top: group.top - 34, left };
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
  // Which marker/cluster group (by `VideoMarkerGroup.key`) the pointer is
  // currently near, and which cluster (if any) is expanded into a list.
  // Both are coordinate-proximity driven, not real DOM :hover/click — see
  // the tracking/click effects further down for why.
  const [videoHoverGroupKey, setVideoHoverGroupKey] = useState<string | null>(null);
  const [videoOpenClusterKey, setVideoOpenClusterKey] = useState<string | null>(null);

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

  // Read by the coordinate-based click/hover handlers below (registered
  // once, not per-render) so they always see current marker positions/the
  // active video without needing to re-subscribe on every scroll-driven
  // recompute. Two separate refs, deliberately gated differently:
  // `videoMarkerGroupsRef` is *un*gated (every group, regardless of
  // current visibility) and drives hover *detection* — hovering near
  // where a currently-hidden marker would be is what reveals it (see
  // `effectiveVideoControlsVisible` below), so gating this one on
  // visibility would be circular (nothing could ever become hoverable
  // once hidden). `visibleClickTargetsRef` mirrors only what's actually
  // shown right now, since a click shouldn't be able to hit an invisible
  // marker.
  const videoMarkerGroupsRef = useRef<VideoMarkerGroup[]>([]);
  const visibleClickTargetsRef = useRef<VideoMarkerGroup[]>([]);
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
          setVideoOpenClusterKey(null);
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

  // Seeking the active video from a JSX-triggered handler (marker/cluster
  // click) is declared here and *performed* in the effect below — mutating
  // `videoMatchRef.current.video.currentTime` directly from a plain
  // callback (even a `useCallback`) trips this codebase's immutability
  // lint rule, which only recognizes the mutation as safe when it happens
  // literally inside a `useEffect` body (the same reason the coordinate-
  // based pointerdown handler below does its own seeking inline rather
  // than calling out to a shared helper). `nonce` forces the effect to
  // re-fire even for two requests with the identical timestamp (e.g.
  // clicking the same marker twice), since object identity alone
  // wouldn't otherwise change for equal values.
  const [videoSeekRequest, setVideoSeekRequest] = useState<{
    timestamp: number;
    nonce: number;
  } | null>(null);
  const videoSeekNonceRef = useRef(0);
  useEffect(() => {
    if (!videoSeekRequest) return;
    // Deferred to a microtask — same reason the coordinate-based
    // pointerdown handler's mutation (which the immutability lint rule
    // does accept) lives inside an event-listener callback rather than an
    // effect's own synchronous body: the rule only recognizes a ref-held
    // DOM mutation as safe once it's decoupled from the effect's direct,
    // synchronous execution. Negligible real delay for a video seek.
    queueMicrotask(() => {
      const video = videoMatchRef.current?.video;
      // Jump to the stored timestamp only — never call play()/pause(), so
      // a playing video keeps playing and a paused one stays paused
      // (spec: "Never unexpectedly autoplay").
      if (video) video.currentTime = videoSeekRequest.timestamp;
    });
  }, [videoSeekRequest]);

  const handleVideoMarkerOpen = useCallback((timestamp: number) => {
    setVideoOpenClusterKey(null);
    videoSeekNonceRef.current += 1;
    setVideoSeekRequest({ timestamp, nonce: videoSeekNonceRef.current });
  }, []);

  const handleVideoClusterToggle = useCallback((key: string) => {
    setVideoOpenClusterKey((prev) => (prev === key ? null : key));
  }, []);

  const handleVideoClusterSelect = useCallback((item: VideoMarkerClusterItem) => {
    setVideoOpenClusterKey(null);
    videoSeekNonceRef.current += 1;
    setVideoSeekRequest({ timestamp: item.anchor.timestamp, nonce: videoSeekNonceRef.current });
  }, []);

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

  // ---- Derived: video marker items grouped into clusters ----
  // Notes close enough together on the rail (`VIDEO_CLUSTER_THRESHOLD_PX`)
  // render as one cluster instead of overlapping dots — see
  // `domain/video-markers.ts`'s `clusterMarkers` for the grouping rule.
  const videoMarkerGroups = useMemo((): VideoMarkerGroup[] => {
    if (videoMarkerItems.length === 0) return [];
    const clusters = clusterMarkers(
      videoMarkerItems.map((item) => ({ item, x: item.left })),
      VIDEO_CLUSTER_THRESHOLD_PX,
    );
    return clusters.map((c) => ({
      key: c.items.map((i) => i.note.id).join(','),
      items: c.items,
      top: c.items[0].top,
      left: c.x,
    }));
  }, [videoMarkerItems]);

  // Markers are also revealed while the pointer is near one, even if
  // `videoControlsVisible` itself says hidden — the fallback rail now sits
  // just outside the video's own box (see `getRailPlacement`), so it isn't
  // covered by the video's real `:hover` state the way `areControlsVisible`
  // assumes; without this, a marker the user is actively pointing at could
  // stay (or become) invisible right as they try to interact with it.
  const effectiveVideoControlsVisible = videoControlsVisible || videoHoverGroupKey !== null;

  // `videoMarkerGroupsRef` stays *un*gated (every group, always) — hover
  // detection below needs to find markers that aren't visible yet in order
  // to reveal them; gating it here would make that impossible. Only the
  // click-target ref is gated, since a click shouldn't be able to hit a
  // marker that isn't actually shown.
  useEffect(() => {
    videoMarkerGroupsRef.current = videoMarkerGroups;
    visibleClickTargetsRef.current = effectiveVideoControlsVisible ? videoMarkerGroups : [];
  }, [videoMarkerGroups, effectiveVideoControlsVisible]);

  // ---- Video marker hover: coordinate-based, not real DOM :hover ----
  // Same reasoning as the click handler below — a hit-testable overlay
  // sitting on top of the player would steal hover from it. Pointer
  // position is stored in a ref on every move (cheap) and the actual state
  // update is rAF-coalesced, the same pattern `useViewportFrame` already
  // uses for scroll/resize.
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const recompute = () => {
      raf = 0;
      const pos = lastPointerPosRef.current;
      const groups = videoMarkerGroupsRef.current;
      if (!pos || groups.length === 0) {
        setVideoHoverGroupKey(null);
        return;
      }
      let closestKey: string | null = null;
      let closestDist = Infinity;
      for (const g of groups) {
        const dist = Math.hypot(pos.x - g.left, pos.y - g.top);
        if (dist <= VIDEO_MARKER_HIT_RADIUS && dist < closestDist) {
          closestKey = g.key;
          closestDist = dist;
        }
      }
      setVideoHoverGroupKey(closestKey);
    };
    const onPointerMove = (e: PointerEvent) => {
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(recompute);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  // ---- Global pointerdown: video marker clicks + outside-click-closes ----
  // Combined into one listener rather than two separate ones: the video
  // marker hit-test and "click outside closes composer/viewer/cluster
  // list" both need to run on the same pointerdown, and as two independent
  // `window` listeners their relative order (i.e. which state update
  // "wins") was an accident of registration order — which mattered for,
  // e.g., a second click toggling an already-open cluster closed racing
  // against a separate "outside click" listener that would otherwise
  // already have cleared it first.
  //
  // Video marker/cluster hit-testing is coordinate-based, not real DOM
  // hit-testing: markers render with `pointer-events: none` (see the
  // render below). A real, on-top, pointer-events:auto marker sitting
  // over a video steals mouse hover from the actual player element
  // beneath it — from YouTube's own perspective (or a native
  // `<video controls>` scrubber's) the pointer has left the player
  // entirely the instant it's over a marker, hiding *their* controls too
  // (a real flicker bug, not just cosmetic — it also broke
  // `html5-generic.ts`'s own hover-based `areControlsVisible` heuristic
  // the same way). Detecting clicks by coordinate proximity instead lets
  // real pointer events pass straight through to the player underneath.
  //
  // Registered once (not per-render) and reads current state from refs,
  // since marker positions change on every scroll-driven recompute and
  // this shouldn't re-subscribe that often.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const groups = visibleClickTargetsRef.current;
      let closest: VideoMarkerGroup | null = null;
      let closestDist = Infinity;
      for (const g of groups) {
        const dist = Math.hypot(e.clientX - g.left, e.clientY - g.top);
        if (dist <= VIDEO_MARKER_HIT_RADIUS && dist < closestDist) {
          closest = g;
          closestDist = dist;
        }
      }

      if (closest) {
        // Preempt the underlying player's own click-to-seek (YouTube's
        // scrubber, or a native <video controls> scrubber) so it doesn't
        // *also* seek — the whole reason markers overlap the player's own
        // hoverable/clickable region is to stay within its hover
        // tracking, which means a real click here also lands on
        // whatever's beneath.
        e.preventDefault();
        e.stopPropagation();
        if (closest.items.length > 1) {
          // A single note among the cluster's own click targets: opening
          // (not seeking) — the cluster list drives the actual seek once
          // a specific note is chosen.
          setVideoOpenClusterKey((prev) => (prev === closest!.key ? null : closest!.key));
        } else {
          setVideoOpenClusterKey(null);
          const video = videoMatchRef.current?.video;
          // Jump to the stored timestamp only — never call play()/
          // pause(), so a playing video keeps playing and a paused one
          // stays paused (spec: "Never unexpectedly autoplay").
          if (video) video.currentTime = closest.items[0].anchor.timestamp;
        }
        return;
      }

      // No marker/cluster hit: fall through to "click outside closes the
      // non-modal composer/viewer/cluster-list." A click inside any
      // .hm-card (composer, viewer, quick-note, or the cluster list — its
      // own row selection is a real DOM click, not this coordinate hack)
      // is exempted, same as it already was before this handler merge.
      const path = e.composedPath();
      const insideCard = path.some(
        (n) => n instanceof HTMLElement && n.classList?.contains('hm-card'),
      );
      const onElementMarker = path.some(
        (n) => n instanceof HTMLElement && n.classList?.contains('hm-marker'),
      );
      if (!insideCard && !onElementMarker) {
        setComposer(null);
        setViewerId(null);
        setVideoComposer(null);
        setVideoOpenClusterKey(null);
      }
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

  // Not gated on visibility — proximity to a group is exactly what
  // (re)reveals it via `effectiveVideoControlsVisible` above; gating this
  // too would mean nothing hidden could ever be discovered by hovering.
  const hoveredVideoGroup = videoMarkerGroups.find((g) => g.key === videoHoverGroupKey);
  // Also ungated: once a cluster list is explicitly opened, it stays open
  // regardless of ambient hover/controls state — same as the composer or
  // quick-note popup, which aren't tied to video-controls-visibility
  // either. It only closes via an explicit action (outside click, Escape,
  // selecting an item).
  const openVideoCluster = videoMarkerGroups.find(
    (g) => g.key === videoOpenClusterKey && g.items.length > 1,
  );

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

      {effectiveVideoControlsVisible &&
        videoMarkerGroups.map((g) =>
          g.items.length === 1 ? (
            <VideoMarker
              key={g.key}
              label={strings.videoMarkerLabel(formatVideoTimestamp(g.items[0].anchor.timestamp))}
              // pointer-events stays 'none' (the .hm-scope default) — real
              // mouse clicks are handled by the coordinate-based listener
              // above, not by this element being hit-tested directly. This
              // still renders a real, focusable <button>, so Tab + Enter/
              // Space (keyboard activation dispatches a trusted click event
              // directly at the focused element, bypassing pointer
              // hit-testing entirely) keeps working.
              style={{ top: g.top, left: g.left }}
              onOpen={() => handleVideoMarkerOpen(g.items[0].anchor.timestamp)}
            />
          ) : (
            <VideoMarkerCluster
              key={g.key}
              count={g.items.length}
              label={strings.videoClusterLabel(g.items.length)}
              style={{ top: g.top, left: g.left }}
              onOpen={() => handleVideoClusterToggle(g.key)}
            />
          ),
        )}

      {hoveredVideoGroup &&
        hoveredVideoGroup.key !== videoOpenClusterKey &&
        (hoveredVideoGroup.items.length === 1 ? (
          <VideoMarkerPreview
            preview={firstLineOf(hoveredVideoGroup.items[0].note.content)}
            timestamp={formatVideoTimestamp(hoveredVideoGroup.items[0].anchor.timestamp)}
            style={videoHoverInfoStyle(hoveredVideoGroup)}
          />
        ) : (
          <SelectionHint
            text={strings.videoClusterLabel(hoveredVideoGroup.items.length)}
            style={videoHoverInfoStyle(hoveredVideoGroup)}
          />
        ))}

      {openVideoCluster && (
        <FloatingVideoClusterList
          group={openVideoCluster}
          strings={strings}
          onSelect={handleVideoClusterSelect}
          onClose={() => setVideoOpenClusterKey(null)}
        />
      )}

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

function FloatingVideoClusterList({
  group,
  strings,
  onSelect,
  onClose,
}: {
  group: VideoMarkerGroup;
  strings: Strings;
  onSelect: (item: VideoMarkerClusterItem) => void;
  onClose: () => void;
}) {
  // Anchored to the cluster's own rail position (a synthetic zero-size
  // rect, same technique `FloatingViewer` uses when its note has no
  // resolved element) — above it, same reasoning as the quick-note popup.
  const getRect = useCallback(
    (): AnchorRect => ({ left: group.left, top: group.top, width: 0, height: 0 }),
    [group.left, group.top],
  );
  const { cardRef, style } = useFloatingAbove(getRect);
  return (
    <div ref={cardRef} className="hm-floating" style={style}>
      <VideoMarkerClusterList
        items={group.items}
        strings={strings}
        onSelect={onSelect}
        onClose={onClose}
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

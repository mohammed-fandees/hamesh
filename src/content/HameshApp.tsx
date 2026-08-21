import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { Note, ElementAnchor, TextAnchor, VideoAnchor } from '@/domain/note';
import { buildElementAnchor } from '@/domain/anchor';
import { buildVideoAnchor } from '@/domain/video-anchor';
import { buildTextAnchor } from '@/domain/text-anchor';
import { resolveTextAnchors } from '@/domain/text-anchor-resolution';
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
import type { AppearanceMode, TextNotePreferences } from '@/domain/preferences';
import { DEFAULT_TEXT_NOTE_PREFERENCES } from '@/domain/preferences';
import {
  captureTextSelection,
  rectsContainPoint,
  visibleRangeRects,
  type TextSelectionCapture,
} from '@/content/text-selection';
import {
  clearTextHighlights,
  ensureHighlightStyles,
  paintTextHighlights,
  setTextHoverCursor,
} from '@/content/text-highlights';
import { useFloating, useFloatingAbove, type AnchorRect } from '@/content/useFloating';
import { getVideoAdapters, getActiveAdapterMatch } from '@/content/video-adapters/registry';
import type { VideoPlayerAdapter } from '@/content/video-adapters/types';
import type { AdapterVideoMatch } from '@/content/video-adapters/registry';
import { Composer } from '@/ui/Composer';
import { NoteViewer } from '@/ui/NoteViewer';
import { Marker } from '@/ui/Marker';
import { SelectionHint } from '@/ui/SelectionHint';
import { TextSelectionAction } from '@/ui/TextSelectionAction';
import { TextNotePopup } from '@/ui/TextNotePopup';
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

/** A contextual text note plus wherever (if anywhere) its text currently
 *  lives on this page. `range === null` is a perfectly normal state — the
 *  note is intact, the page just doesn't hold its text right now — and is
 *  never allowed to mean "so highlight something else". */
interface TextResolved {
  note: Note;
  anchor: TextAnchor;
  range: Range | null;
  quality: ResolutionQuality;
}

/** How long the hover popup survives the pointer leaving the highlighted
 *  text, so the gap between the words and the card can be crossed without
 *  the card vanishing mid-reach. */
const TEXT_POPUP_GRACE_MS = 220;

/** How long the Open Note flow keeps waiting for a contextual note's text to
 *  turn up before opening the note anyway with its "couldn't find this text"
 *  state. Content loaded after `document_idle` (an SPA route, a lazy
 *  section) resolves well inside this; a page that genuinely no longer has
 *  the text shouldn't leave the user staring at nothing. */
const TEXT_RESTORE_GRACE_MS = 3000;

/** Mirrors the video restore highlight's duration in tokens.css — long
 *  enough to catch the eye after a scroll, short enough not to linger. */
const TEXT_FLASH_MS = 1400;

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

/** What the composer is currently attached to. Both shapes carry a
 *  ready-built anchor, so saving is anchor-kind-agnostic — see `handleSave`. */
type ComposerTarget =
  | { kind: 'element'; element: Element; anchor: ElementAnchor }
  | { kind: 'text'; anchor: TextAnchor; range: Range };

interface HameshAppProps {
  repo: NotesRepository;
  prefsRepo: PreferencesRepository;
  /** The language to render before the stored preference (if any) has
   *  loaded — already resolved from the browser's UI language, so this is
   *  exactly today's behavior for users with no saved choice. */
  initialLang: Lang;
  /** Imperatively toggles selection mode; wired to the content-script controller. */
  registerActivate: (fn: () => void) => void;
  /** Imperatively opens the video quick-note for the page's current video, if
   *  any; wired to the content-script controller's dedicated video shortcut. */
  registerActivateVideo: (fn: () => void) => void;
  /** Imperatively opens the composer for the page's current text selection —
   *  the keyboard half of the contextual-note entry points, wired to the
   *  content-script controller's dedicated text shortcut. A no-op when
   *  nothing anchorable is selected. */
  registerActivateText: (fn: () => void) => void;
  /** Imperatively restores (scrolls to, highlights, opens) a specific note by
   *  id — wired to the content-script controller's `RESTORE_NOTE` handler,
   *  which fires from the Notes Library's Open Note flow. */
  registerRestoreNote: (fn: (noteId: string) => void) => void;
}

function toAnchorRect(el: Element): AnchorRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** A live rect for a text range — recomputed on every scroll/resize by
 *  `useFloating`, the same way an element anchor's rect is. */
function rangeAnchorRect(range: Range): AnchorRect {
  const r = range.getBoundingClientRect();
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
  registerActivateVideo,
  registerActivateText,
  registerRestoreNote,
}: HameshAppProps) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [appearance, setAppearance] = useState<AppearanceMode>('match-website');
  const [textNotes, setTextNotes] = useState<TextNotePreferences>(DEFAULT_TEXT_NOTE_PREFERENCES);
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
        setTextNotes(prefs.textNotes);
      }
    })();
    const unwatch = prefsRepo.watch((prefs) => {
      setLang(prefs.language ?? initialLang);
      setAppearance(prefs.appearance);
      setTextNotes(prefs.textNotes);
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

  // One composer for both kinds of note, so there is exactly one save path
  // (`handleSave`) rather than a parallel one per anchor kind. The anchor is
  // built at the moment the composer opens — from the preserved range for a
  // text note — never at save time, so a page that changes while the user is
  // typing can't silently re-point the note at different text.
  const [composer, setComposer] = useState<ComposerTarget | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  /** Set when the viewer is opened straight into edit mode (the hover
   *  popup's Edit button) — see the `key` on `FloatingViewer` below. */
  const [viewerEditing, setViewerEditing] = useState(false);
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

  // ---- Contextual text notes ----
  const [textResolved, setTextResolved] = useState<TextResolved[]>([]);
  /** The finished, still-valid selection the action chip is offering itself
   *  for. Holding the captured range here (rather than reading
   *  `window.getSelection()` when the chip is clicked) is what guarantees the
   *  note attaches to the text the user actually selected — clicking any
   *  external UI can collapse or move the live selection. */
  const [pendingSelection, setPendingSelection] = useState<TextSelectionCapture | null>(null);
  const [hoverTextId, setHoverTextId] = useState<string | null>(null);
  /** Briefly painted more strongly by the Open Note flow — "here it is". */
  const [flashTextId, setFlashTextId] = useState<string | null>(null);
  const [scrollToTextId, setScrollToTextId] = useState<string | null>(null);

  // ---- Open Note flow: restore a specific note by id once it resolves ----
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  /** True once a pending contextual-note restore has waited long enough (see
   *  `TEXT_RESTORE_GRACE_MS`); the note then opens with its "couldn't find
   *  this text" state instead of waiting forever. */
  const [restoreExpired, setRestoreExpired] = useState(false);
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<Note[]>([]);
  /** Last pass's resolved ranges, keyed by note id. Feeding these back into
   *  the next pass turns the common case into one string compare per note —
   *  no DOM walk, no page-text index. Rebuilt every pass, never a cache with
   *  its own lifetime. */
  const previousTextRangesRef = useRef<Map<string, Range>>(new Map());
  /** Viewport rects of every currently-resolved highlight, for the
   *  coordinate hit-testing that stands in for the hover/click a
   *  Custom-Highlight range can't receive itself. */
  const textHitTargetsRef = useRef<{ id: string; rects: DOMRect[] }[]>([]);
  const textResolvedRef = useRef<TextResolved[]>([]);
  const textPopupHoveredRef = useRef(false);
  const textPopupTimerRef = useRef(0);
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

  // Runs across the same unified `notes` list as the other two resolvers.
  // Batched deliberately: `resolveTextAnchors` revalidates last pass's
  // ranges and tries the stored DOM paths first, and only builds a
  // normalized index of the page's text if something actually needs
  // recovering — and then builds it once for all of them.
  const resolveAllText = useCallback((list: Note[], enabled: boolean) => {
    const requests = [];
    for (const note of list) {
      if (note.anchor.type !== 'text') continue;
      requests.push({
        id: note.id,
        anchor: note.anchor,
        previous: previousTextRangesRef.current.get(note.id) ?? null,
      });
    }

    // Disabling the feature stops it resolving and painting. It does not
    // touch a single stored note or anchor — turning it back on simply
    // resolves them again.
    if (!enabled || requests.length === 0) {
      previousTextRangesRef.current = new Map();
      setTextResolved([]);
      return;
    }

    const results = resolveTextAnchors(requests);
    const nextRanges = new Map<string, Range>();
    const next: TextResolved[] = [];
    for (const note of list) {
      if (note.anchor.type !== 'text') continue;
      const result = results.get(note.id);
      const range = result?.range ?? null;
      if (range) nextRanges.set(note.id, range);
      next.push({
        note,
        anchor: note.anchor,
        range,
        quality: result?.quality ?? ResolutionQuality.Unresolved,
      });
    }
    previousTextRangesRef.current = nextRanges;
    setTextResolved(next);
  }, []);

  const refreshVideoMatch = useCallback(() => {
    setVideoMatch(getActiveAdapterMatch());
  }, []);

  /** Commit a new notes list to both state slices (avoids nested setState). */
  // `textNotesEnabled` is a real dependency, not incidental: turning the
  // feature on or off changes this callback's identity, which re-runs the
  // load effect below and so re-resolves (or drops) every contextual note's
  // highlight — no separate "the setting changed" trigger needed, and no
  // stored note touched either way.
  const textNotesEnabled = textNotes.enabled;
  const commitNotes = useCallback(
    (next: Note[]) => {
      notesRef.current = next;
      setNotes(next);
      resolveAll(next);
      resolveAllVideo(next);
      resolveAllText(next, textNotesEnabled);
    },
    [resolveAll, resolveAllVideo, resolveAllText, textNotesEnabled],
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
        resolveAllText(notes, textNotesEnabled);
        refreshVideoMatch();
      }, 400);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [notes, resolveAll, resolveAllVideo, resolveAllText, textNotesEnabled, refreshVideoMatch]);

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
  // the player container's chrome-visibility attributes: `class` (YouTube
  // toggles `.ytp-autohide` there — see youtube.ts) and `data-hamesh-controls`
  // (an opt-in custom player toggles it as its chrome fades — see
  // custom-timeline.ts). A custom player's own overlays sit on top of the
  // `<video>`, so the pointer events above rarely reach it; the attribute
  // observer is what actually keeps its markers in sync. Some of these are
  // no-ops for a given adapter; cheap enough not to bother branching here.
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
      observer.observe(container, {
        attributes: true,
        attributeFilter: ['class', 'data-hamesh-controls'],
      });
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

  // Alt+H always opens element selection — the same thing it did before
  // video notes existed. An earlier version made this context-aware
  // (hovering/focusing the video opened a video note instead), but that
  // heuristic proved unreliable on real sites: real players layer overlay
  // UI (play buttons, ad chrome, custom controls) that defeats both DOM-
  // containment and pointer-coordinate hover checks often enough to cause
  // real confusion between "this made an element note" and "this made a
  // video note." `activateVideo` below is the deterministic replacement.
  const activate = useCallback(() => {
    setViewerId(null);
    setComposer(null);
    setVideoComposer(null);
    setSelecting(true);
  }, []);

  // Alt+V (default; customizable in the Notes Library's Settings) — a
  // dedicated shortcut for video notes, so there's no hover/focus guess:
  // it always targets whichever video the page's adapter currently
  // considers active, regardless of pointer position. A no-op if the page
  // has no video right now.
  const activateVideo = useCallback(() => {
    if (!videoMatch) return;
    setViewerId(null);
    setComposer(null);
    setSelecting(false);
    setVideoComposer(videoMatch);
  }, [videoMatch]);

  // ---- Contextual text notes: one creation flow, two entry points ----

  /** The Hamesh shadow host, so a selection made inside Hamesh's own UI (or
   *  a click on it) is never mistaken for a selection in the page. */
  const hameshHost = useCallback((): Element | null => {
    const root = scopeRef.current?.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  }, []);

  /**
   * The single contextual-note creation flow. The selection action chip and
   * the keyboard shortcut both land here — same validation, same anchor
   * generation, same composer, and (via `handleSave`) the same note creation
   * and persistence as every other Hamesh note. Neither entry point has any
   * note logic of its own.
   */
  const startTextNote = useCallback((capture: TextSelectionCapture) => {
    setPendingSelection(null);
    // Built from the preserved range, right now — before any of the state
    // changes below can move focus or collapse what's selected.
    const built = buildTextAnchor(capture.range);
    if (!built) return;
    setSelecting(false);
    setHover(null);
    setViewerId(null);
    setVideoComposer(null);
    setError(null);
    setComposer({ kind: 'text', anchor: built.anchor, range: built.range });
  }, []);

  // Alt+T (default; rebindable in Chrome's own shortcuts page, linked from
  // Settings). Reads the live selection itself, so it works identically
  // whether or not the selection action chip is switched on — and does
  // nothing at all when there's no valid selection, rather than creating an
  // empty contextual note.
  const activateText = useCallback(() => {
    if (!textNotes.enabled) return;
    const capture = captureTextSelection(hameshHost());
    if (!capture) return;
    startTextNote(capture);
  }, [textNotes.enabled, hameshHost, startTextNote]);

  useEffect(() => registerActivate(activate), [registerActivate, activate]);
  useEffect(() => registerActivateVideo(activateVideo), [registerActivateVideo, activateVideo]);
  useEffect(() => registerActivateText(activateText), [registerActivateText, activateText]);

  useEffect(
    () =>
      registerRestoreNote((noteId) => {
        setRestoreExpired(false);
        setPendingRestoreId(noteId);
      }),
    [registerRestoreNote],
  );

  /** The single way the note viewer is opened. `editing` is part of opening
   *  it, not sticky state — without this, using the hover popup's Edit and
   *  then opening some other note by its marker would open *that* note in
   *  edit mode too. */
  const openViewer = useCallback((noteId: string, editing = false) => {
    setComposer(null);
    setError(null);
    setViewerEditing(editing);
    setViewerId(noteId);
  }, []);

  // Seeking the active video from a JSX-triggered handler (marker/cluster
  // click, or the Open Note restore flow below) is declared here and
  // *performed* in the effect below — mutating
  // `videoMatchRef.current.video.currentTime` directly from a plain
  // callback (even a `useCallback`) trips this codebase's immutability
  // lint rule, which only recognizes the mutation as safe once it happens
  // inside a `useEffect` body (the same reason the coordinate-based
  // pointerdown handler further down does its own seeking inline rather
  // than calling out to a shared helper). `nonce` forces the effect to
  // re-fire even for two requests with the identical timestamp (e.g.
  // clicking the same marker twice), since object identity alone
  // wouldn't otherwise change for equal values. Declared before the
  // restore-flow logic below, which is also a producer of seek requests.
  const [videoSeekRequest, setVideoSeekRequest] = useState<{
    timestamp: number;
    // A number for marker/cluster clicks (a ref counter, incremented in an
    // event handler); a string for the Open Note restore flow below, which
    // has no ref access available (that logic runs during render) but
    // doesn't need one anyway — `restoredFor` already limits it to firing
    // once per distinct note id, so the id itself is a sufficiently unique
    // nonce.
    nonce: number | string;
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

  // Adjusts state as soon as the pending restore target appears resolved
  // — React's documented pattern for reacting to a dependency change
  // during render rather than in an Effect (see "You Might Not Need an
  // Effect"). `pendingRestoreId !== restoredFor` makes this self-limiting:
  // it only fires once per restore request, and if the note hasn't loaded
  // yet (RESTORE_NOTE can arrive before the initial notes fetch finishes,
  // or — for a video note on a heavy SPA like YouTube — before the
  // `<video>` element even exists yet) it simply re-checks on the next
  // render that `resolved`/`videoResolved` changes on (the latter already
  // gets re-run by the debounced DOM-settle effect above) — no polling,
  // no fixed delay.
  if (pendingRestoreId && pendingRestoreId !== restoredFor) {
    const pendingNote = notes.find((n) => n.id === pendingRestoreId);
    if (pendingNote?.anchor.type === 'video') {
      const videoAnchor = pendingNote.anchor;
      const target = videoResolved.find((r) => r.note.id === pendingRestoreId);
      if (target?.quality === ResolutionQuality.Exact) {
        setRestoredFor(pendingRestoreId);
        // Seeks and opens the viewer — same as clicking the note's
        // on-page marker (see handleVideoMarkerOpen). Never calls
        // play()/pause() (spec: "Never unexpectedly autoplay"); a fresh
        // tab's video is simply left in whatever state it loaded in.
        setComposer(null);
        setError(null);
        setViewerId(pendingRestoreId);
        setVideoSeekRequest({ timestamp: videoAnchor.timestamp, nonce: pendingRestoreId });
      }
    } else if (pendingNote?.anchor.type === 'text') {
      // Waits for the text to turn up (content can still be loading), but
      // only for `TEXT_RESTORE_GRACE_MS` — after that the note opens anyway,
      // honestly showing that its text couldn't be found rather than
      // pretending the navigation worked.
      const target = textResolved.find((r) => r.note.id === pendingRestoreId);
      const resolvedNow = !!target && target.quality !== ResolutionQuality.Unresolved;
      if (target && (resolvedNow || restoreExpired)) {
        setRestoredFor(pendingRestoreId);
        setComposer(null);
        setError(null);
        setViewerEditing(false);
        setViewerId(pendingRestoreId);
        if (target.range) {
          setFlashTextId(pendingRestoreId);
          setScrollToTextId(pendingRestoreId);
        }
      }
    } else {
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

  // ---- Selection watching: show the action chip, and only the chip ----
  // A completed selection is detected on mouseup/keyup, never on
  // `selectionchange` — that fires continuously while the pointer is still
  // dragging, and a chip appearing mid-drag would be exactly the
  // "interfering with normal selection" this must not do. `selectionchange`
  // is used only to take the chip *away* again.
  useEffect(() => {
    if (!textNotes.enabled || !textNotes.selectionAction) return;

    const host = hameshHost();
    let raf = 0;

    const insideHamesh = (event: Event): boolean =>
      event
        .composedPath()
        .some(
          (node) =>
            node instanceof HTMLElement &&
            (node === host ||
              node.classList?.contains('hm-card') ||
              node.classList?.contains('hm-marker')),
        );

    const offerSelection = () => {
      if (raf) cancelAnimationFrame(raf);
      // One frame later: the browser finalizes the selection after mouseup,
      // and a same-tick read can still see the previous one.
      raf = requestAnimationFrame(() => {
        raf = 0;
        setPendingSelection(captureTextSelection(host));
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (insideHamesh(e)) return;
      offerSelection();
    };

    const onMouseDown = (e: MouseEvent) => {
      // A new press means a new selection is starting (or the user is
      // dismissing this one) — the chip goes away either way, unless the
      // press *is* the chip.
      if (insideHamesh(e)) return;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      setPendingSelection(null);
    };

    const SELECTION_KEYS = new Set([
      'Shift',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'a',
      'A',
    ]);
    const onKeyUp = (e: KeyboardEvent) => {
      if (!SELECTION_KEYS.has(e.key)) return;
      offerSelection();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingSelection(null);
    };

    const onSelectionChange = () => {
      const selection = window.getSelection?.();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setPendingSelection(null);
      }
    };

    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [textNotes.enabled, textNotes.selectionAction, hameshHost]);

  // ---- Painting the highlights ----
  // Rebuilt from the current resolution each time rather than diffed, so a
  // repaint can't leave a stale highlight behind (see `paintTextHighlights`).
  useEffect(() => {
    if (!textNotes.enabled) {
      clearTextHighlights();
      return;
    }
    ensureHighlightStyles(theme);
    const ranges: Range[] = [];
    const flash: Range[] = [];
    for (const item of textResolved) {
      if (!item.range) continue;
      if (item.note.id === flashTextId) flash.push(item.range);
      else ranges.push(item.range);
    }
    paintTextHighlights(ranges, flash);
  }, [textResolved, textNotes.enabled, theme, flashTextId]);

  // Leave the page exactly as found when the content script UI goes away.
  useEffect(() => () => clearTextHighlights(), []);

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
      setComposer({ kind: 'element', element: el, anchor: buildElementAnchor(el) });
    },
    [elementUnderCursor],
  );

  // ---- Persistence ----
  // One create path for element and contextual text notes alike — same
  // repository, same `CreateNoteInput`, same page key. The only difference
  // between them by this point is which anchor the composer is carrying.
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
        // Seeds the new note's range so its highlight appears immediately
        // and exactly over the captured text, instead of waiting for the
        // resolution pass below to re-derive it.
        if (composer.kind === 'text') {
          previousTextRangesRef.current.set(note.id, composer.range);
        }
        setComposer(null);
        setPendingSelection(null);
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

  // Clicking a marker both seeks *and* opens the note's viewer — the only
  // way to read/edit/delete/pin a video note, since there's no separate
  // "view" affordance beyond the marker itself (the hover preview is
  // read-only, by design: it has to stay passive so it doesn't itself
  // become another hover-stealing overlay).
  const handleVideoMarkerOpen = useCallback((noteId: string, timestamp: number) => {
    setVideoOpenClusterKey(null);
    setViewerEditing(false);
    setViewerId(noteId);
    videoSeekNonceRef.current += 1;
    setVideoSeekRequest({ timestamp, nonce: videoSeekNonceRef.current });
  }, []);

  const handleVideoClusterToggle = useCallback((key: string) => {
    setVideoOpenClusterKey((prev) => (prev === key ? null : key));
  }, []);

  const handleVideoClusterSelect = useCallback((item: VideoMarkerClusterItem) => {
    setVideoOpenClusterKey(null);
    setViewerEditing(false);
    setViewerId(item.note.id);
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
        previousTextRangesRef.current.delete(noteId);
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
          // Also opens the note's viewer — see handleVideoMarkerOpen's
          // doc comment for why a click needs to do both.
          setViewerId(closest.items[0].note.id);
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

  // ---- Derived: where each highlight currently is on screen ----
  // Highlights are painted by the Custom Highlight API, which produces no
  // DOM node — so hovering and clicking them is coordinate work against
  // their range rects, recomputed per viewport frame (the same rAF-coalesced
  // `frame` the markers use). Only computed while there is something to
  // compute.
  const textHitTargets = useMemo(() => {
    void frame;
    if (!textNotes.enabled || textResolved.length === 0) return [];
    const targets: { id: string; rects: DOMRect[] }[] = [];
    for (const item of textResolved) {
      if (!item.range) continue;
      const rects = visibleRangeRects(item.range);
      if (rects.length > 0) targets.push({ id: item.note.id, rects });
    }
    return targets;
  }, [textResolved, textNotes.enabled, frame]);

  useEffect(() => {
    textHitTargetsRef.current = textHitTargets;
  }, [textHitTargets]);

  useEffect(() => {
    textResolvedRef.current = textResolved;
  }, [textResolved]);

  // ---- Hover over highlighted text ----
  // Hover *intent*, not raw hover: leaving the text starts a short grace
  // period rather than closing the popup, so the pointer can cross the gap
  // into the card. Entering the card cancels it outright.
  useEffect(() => {
    if (!textNotes.enabled) return;
    let raf = 0;
    let last: { x: number; y: number } | null = null;

    const clearPopupTimer = () => {
      if (textPopupTimerRef.current) {
        clearTimeout(textPopupTimerRef.current);
        textPopupTimerRef.current = 0;
      }
    };

    const recompute = () => {
      raf = 0;
      const pos = last;
      if (!pos) return;
      const hit = textHitTargetsRef.current.find((target) =>
        rectsContainPoint(target.rects, pos.x, pos.y),
      );
      // Highlighted text is clickable, so it should say so. A highlight has
      // no element of its own to put `cursor` on (and `::highlight()` can't
      // carry it), so the page-level stylesheet Hamesh already injects
      // supplies the rule and this toggles the attribute that switches it
      // on — see `setTextHoverCursor`.
      setTextHoverCursor(!!hit);
      if (hit) {
        clearPopupTimer();
        setHoverTextId(hit.id);
        return;
      }
      if (textPopupHoveredRef.current || textPopupTimerRef.current) return;
      textPopupTimerRef.current = window.setTimeout(() => {
        textPopupTimerRef.current = 0;
        if (!textPopupHoveredRef.current) setHoverTextId(null);
      }, TEXT_POPUP_GRACE_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(recompute);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearPopupTimer();
      setTextHoverCursor(false);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [textNotes.enabled]);

  // ---- Click on highlighted text opens its note ----
  // On `click`, not `pointerdown`, and never `preventDefault`-ed: pressing
  // inside highlighted text must still start a normal selection, and a
  // highlight that happens to sit on a link must still let the link win.
  // A click that produced a selection, or that landed on something
  // interactive, is left entirely alone.
  useEffect(() => {
    if (!textNotes.enabled) return;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      const path = e.composedPath();
      const insideHameshUi = path.some(
        (node) =>
          node instanceof HTMLElement &&
          (node.classList?.contains('hm-card') || node.classList?.contains('hm-marker')),
      );
      if (insideHameshUi) return;
      const onInteractive = path.some(
        (node) =>
          node instanceof HTMLElement &&
          ['a', 'button', 'input', 'select', 'textarea', 'label', 'summary'].includes(
            node.tagName.toLowerCase(),
          ),
      );
      if (onInteractive) return;
      const selection = window.getSelection?.();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) return;

      const hit = textHitTargetsRef.current.find((target) =>
        rectsContainPoint(target.rects, e.clientX, e.clientY),
      );
      if (!hit) return;
      openViewer(hit.id);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [textNotes.enabled, openViewer]);

  // ---- Open Note flow: scroll a restored contextual note into view ----
  // Kept separate from the state adjustment that requests it, and keyed on
  // an id that only changes when explicitly set — same reasoning as the
  // element restore's own scroll effect above.
  useEffect(() => {
    if (!scrollToTextId) return;
    const target = textResolvedRef.current.find((item) => item.note.id === scrollToTextId);
    const anchorElement = target?.range?.startContainer.parentElement ?? null;
    if (anchorElement) {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      anchorElement.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }
    const timer = window.setTimeout(() => {
      setFlashTextId(null);
      setScrollToTextId(null);
    }, TEXT_FLASH_MS);
    return () => clearTimeout(timer);
  }, [scrollToTextId]);

  // A pending contextual restore that hasn't resolved yet gets one bounded
  // wait — see TEXT_RESTORE_GRACE_MS.
  useEffect(() => {
    if (!pendingRestoreId) return;
    const timer = window.setTimeout(() => setRestoreExpired(true), TEXT_RESTORE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [pendingRestoreId]);

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

  // Placed just past the end of the selection's last line, clamped into the
  // viewport, and re-derived from the live range each frame so it tracks the
  // text while the page scrolls. Never over the selection itself — it must
  // not cover the words the user is still reading.
  const selectionActionStyle = useMemo((): React.CSSProperties | null => {
    void frame;
    if (!pendingSelection) return null;
    const rects = visibleRangeRects(pendingSelection.range);
    const rect = rects[rects.length - 1];
    if (!rect) return null;
    const SIZE = 24;
    const GAP = 6;
    const rawLeft = dir === 'rtl' ? rect.left - SIZE - GAP : rect.right + GAP;
    const left = Math.max(2, Math.min(rawLeft, window.innerWidth - SIZE - 2));
    const top = Math.max(2, Math.min(rect.top - 2, window.innerHeight - 30));
    return { top, left, pointerEvents: 'auto' };
  }, [pendingSelection, dir, frame]);

  // Suppressed while the composer is open (it would sit over the card the
  // user is typing into) and for whichever note's viewer is already open
  // (the viewer is the popup's own destination — showing both is noise).
  const hoveredTextNote =
    hoverTextId && hoverTextId !== viewerId && !composer
      ? textResolved.find((item) => item.note.id === hoverTextId)
      : undefined;

  const viewerNote = viewerId ? notes.find((n) => n.id === viewerId) : null;
  const viewerIsVideo = viewerNote?.anchor.type === 'video';
  const viewerIsText = viewerNote?.anchor.type === 'text';
  const viewerTextResolved =
    viewerId && viewerIsText ? textResolved.find((r) => r.note.id === viewerId) : null;
  const viewerResolved =
    viewerId && !viewerIsVideo && !viewerIsText
      ? resolved.find((r) => r.note.id === viewerId)
      : null;
  const viewerVideoResolved =
    viewerId && viewerIsVideo ? videoResolved.find((r) => r.note.id === viewerId) : null;
  // The viewer's own marker group — so it anchors above the dot on the
  // rail, same as the cluster list, rather than above the whole video
  // element (which for a large player reads as "a fixed spot on screen"
  // unrelated to where the note actually sits on the timeline).
  const viewerVideoGroup = viewerIsVideo
    ? videoMarkerGroups.find((g) => g.items.some((i) => i.note.id === viewerId))
    : undefined;

  // Not gated on visibility — proximity to a group is exactly what
  // (re)reveals it via `effectiveVideoControlsVisible` above; gating this
  // too would mean nothing hidden could ever be discovered by hovering.
  // Also suppressed for whichever note's viewer is already open, so the
  // read-only hover preview doesn't double up with the (now editable)
  // viewer for the same note.
  const hoveredVideoGroup = videoMarkerGroups.find(
    (g) =>
      g.key === videoHoverGroupKey && !(g.items.length === 1 && g.items[0].note.id === viewerId),
  );
  // Also ungated: once a cluster list is explicitly opened, it stays open
  // regardless of ambient hover/controls state — same as the composer or
  // quick-note popup, which aren't tied to video-controls-visibility
  // either. It only closes via an explicit action (outside click, Escape,
  // selecting an item).
  const openVideoCluster = videoMarkerGroups.find(
    (g) => g.key === videoOpenClusterKey && g.items.length > 1,
  );

  return (
    <div className="hm-scope" data-hm-theme={theme} dir={dir} ref={scopeRef}>
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
          onOpen={() => openViewer(m.note.id)}
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
              onOpen={() => handleVideoMarkerOpen(g.items[0].note.id, g.items[0].anchor.timestamp)}
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

      {textNotes.enabled && textNotes.selectionAction && selectionActionStyle && (
        <TextSelectionAction
          label={strings.textNoteAction}
          flip={dir === 'rtl'}
          style={selectionActionStyle}
          onActivate={() => {
            if (pendingSelection) startTextNote(pendingSelection);
          }}
        />
      )}

      {hoveredTextNote?.range && (
        <FloatingTextPopup
          range={hoveredTextNote.range}
          preview={firstLineOf(hoveredTextNote.note.content)}
          strings={strings}
          onOpen={() => {
            setHoverTextId(null);
            openViewer(hoveredTextNote.note.id);
          }}
          onPointerEnter={() => {
            textPopupHoveredRef.current = true;
          }}
          onPointerLeave={() => {
            textPopupHoveredRef.current = false;
            setHoverTextId(null);
          }}
        />
      )}

      {highlightRect && <div className="hm-restore-highlight" style={highlightRect} />}

      {composer && (
        <FloatingComposer
          target={composer}
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

      {viewerNote && !viewerIsVideo && (
        // Keyed so the viewer starts from a clean state per note, and so
        // opening an already-open note straight into edit mode (the hover
        // popup's Edit) actually re-initializes it.
        <FloatingViewer
          key={`${viewerNote.id}:${viewerEditing ? 'edit' : 'view'}`}
          note={viewerNote}
          element={viewerResolved?.element ?? null}
          range={viewerTextResolved?.range ?? null}
          anchorAvailable={viewerIsText ? !!viewerTextResolved?.range : !!viewerResolved?.element}
          unavailableLabel={viewerIsText ? strings.textAnchorUnavailable : undefined}
          attachedText={viewerNote.anchor.type === 'text' ? viewerNote.anchor.exact : undefined}
          initialEditing={viewerEditing}
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

      {viewerNote && viewerIsVideo && (
        <FloatingVideoViewer
          note={viewerNote}
          video={viewerVideoResolved?.video ?? videoMatch?.video ?? null}
          markerRect={
            viewerVideoGroup ? { left: viewerVideoGroup.left, top: viewerVideoGroup.top } : null
          }
          anchorAvailable={viewerVideoResolved?.quality === ResolutionQuality.Exact}
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

/** One composer for both anchor kinds — it only differs in what it anchors
 *  to (an element's rect or the selected text's rect) and whether it shows
 *  the attached text above the textarea. */
function FloatingComposer({
  target,
  strings,
  busy,
  error,
  onSave,
  onCancel,
}: {
  target: ComposerTarget;
  strings: Strings;
  busy: boolean;
  error: string | null;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const getRect = useCallback(
    (): AnchorRect =>
      target.kind === 'element' ? toAnchorRect(target.element) : rangeAnchorRect(target.range),
    [target],
  );
  const { cardRef, style } = useFloating(getRect, { autoFocus: true });
  return (
    <div ref={cardRef} className="hm-floating" style={{ ...style, width: 300 }}>
      <Composer
        strings={strings}
        attachedText={target.kind === 'text' ? target.anchor.exact : undefined}
        saving={busy}
        error={error}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}

/** The hover preview for highlighted text, anchored above the highlight so
 *  it never covers the words it is about. */
function FloatingTextPopup({
  range,
  preview,
  strings,
  onOpen,
  onPointerEnter,
  onPointerLeave,
}: {
  range: Range;
  preview: string;
  strings: Strings;
  onOpen: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const getRect = useCallback((): AnchorRect => rangeAnchorRect(range), [range]);
  const { cardRef, style } = useFloatingAbove(getRect);
  return (
    <div ref={cardRef} className="hm-floating" style={style}>
      <TextNotePopup
        preview={preview}
        strings={strings}
        onOpen={onOpen}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      />
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
  const { cardRef, style } = useFloatingAbove(getRect, { autoFocus: true });
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

/** The video-note counterpart of `FloatingViewer` below — same `NoteViewer`
 *  component (edit/delete/pin are already anchor-agnostic; nothing about
 *  them needed to change), positioned above the video via
 *  `useFloatingAbove` instead of anchored to a resolved DOM element, since
 *  a video note has no page element to anchor to. */
function FloatingVideoViewer({
  note,
  video,
  markerRect,
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
  video: HTMLVideoElement | null;
  /** The note's own marker position on the rail, if it currently has one
   *  (i.e. its dot is visible) — preferred over `video` so the viewer opens
   *  right above the dot the user clicked, not above the whole player. */
  markerRect: { left: number; top: number } | null;
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
    if (markerRect) return { left: markerRect.left, top: markerRect.top, width: 0, height: 0 };
    if (video) return toAnchorRect(video);
    return {
      left: window.innerWidth / 2 - 150,
      top: window.innerHeight / 2 - 80,
      width: 0,
      height: 0,
    };
  }, [markerRect, video]);
  const { cardRef, style } = useFloatingAbove(getRect);
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

function FloatingViewer({
  note,
  element,
  range,
  anchorAvailable,
  unavailableLabel,
  attachedText,
  initialEditing,
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
  /** A contextual text note's resolved range, when it has one — preferred
   *  over `element` so the viewer opens beside the highlighted words rather
   *  than beside their whole paragraph. */
  range?: Range | null;
  anchorAvailable: boolean;
  unavailableLabel?: string;
  attachedText?: string;
  initialEditing?: boolean;
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
    if (range) return rangeAnchorRect(range);
    if (element) return toAnchorRect(element);
    return {
      left: window.innerWidth / 2 - 150,
      top: window.innerHeight / 2 - 80,
      width: 0,
      height: 0,
    };
  }, [element, range]);
  const { cardRef, style } = useFloating(getRect);
  return (
    <div ref={cardRef} className="hm-floating" style={{ ...style, width: 300 }}>
      <NoteViewer
        note={note}
        strings={strings}
        lang={lang}
        anchorAvailable={anchorAvailable}
        unavailableLabel={unavailableLabel}
        attachedText={attachedText}
        initialEditing={initialEditing}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { Note, ElementAnchor } from '@/domain/note';
import { buildElementAnchor } from '@/domain/anchor';
import { resolveAnchor, ResolutionQuality } from '@/domain/anchor-resolution';
import { generatePageKey } from '@/domain/page-key';
import { getDeepestEligibleElement } from '@/utils/dom';
import { onNavigationChange } from '@/content/navigation';
import { detectHostTheme, type HostTheme } from '@/content/theme';
import type { AppearanceMode } from '@/domain/preferences';
import { useFloating, type AnchorRect } from '@/content/useFloating';
import { Composer } from '@/ui/Composer';
import { NoteViewer } from '@/ui/NoteViewer';
import { Marker } from '@/ui/Marker';
import { SelectionHint } from '@/ui/SelectionHint';
import { getStrings, dirForLang, type Lang, type Strings } from '@/ui/i18n';

interface Resolved {
  note: Note;
  element: Element | null;
  quality: ResolutionQuality;
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
}

function toAnchorRect(el: Element): AnchorRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
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

export function HameshApp({ repo, prefsRepo, initialLang, registerActivate }: HameshAppProps) {
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

  const captureRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<Note[]>([]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const hasFloating = notes.length > 0 || composer !== null || viewerId !== null;
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

  /** Commit a new notes list to both state slices (avoids nested setState). */
  const commitNotes = useCallback(
    (next: Note[]) => {
      notesRef.current = next;
      setNotes(next);
      resolveAll(next);
    },
    [resolveAll],
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
        }
        return key;
      });
      setHostTheme(detectHostTheme());
      loadNotes();
    });
  }, [loadNotes]);

  // ---- Debounced re-resolution as the DOM settles (dynamic content) ----
  useEffect(() => {
    if (notes.length === 0) return;
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => resolveAll(notes), 400);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [notes, resolveAll]);

  // ---- Selection mode ----
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setHover(null);
  }, []);

  const activate = useCallback(() => {
    setViewerId(null);
    setComposer(null);
    setSelecting(true);
  }, []);

  useEffect(() => registerActivate(activate), [registerActivate, activate]);

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
    if (!composer && !viewerId) return;
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
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [composer, viewerId]);

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
        onClose={onClose}
      />
    </div>
  );
}

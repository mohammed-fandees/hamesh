# Hamesh — هامش

**Leave context where it belongs.**

Hamesh is a contextual annotation layer for the web. Attach a note to a specific
element on any page, leave, and find it restored in place when you return. The
name is the Arabic word for _margin_ — the strip beside a manuscript where a
reader leaves a mark. The web removed that strip; Hamesh puts it back.

## MVP scope

One core flow: activate → select an element → write a note → it persists locally
→ a small marker restores it in context on return, where it can be opened,
edited, and deleted. No accounts, no cloud, no sync, no AI. See
[docs/PROMPT.md](docs/PROMPT.md) for the original engineering specification.

## Tech stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Framework  | [WXT](https://wxt.dev) (browser extension tooling)        |
| Manifest   | MV3                                                       |
| UI         | React 19 (mounted in an isolated Shadow DOM)              |
| Language   | TypeScript (strict)                                       |
| Styling    | Design tokens (CSS custom properties); Tailwind available |
| Unit tests | Vitest                                                    |
| E2E tests  | Playwright (drives the real extension UI)                 |

## Architecture

```
src/
├── domain/       # Pure logic: Note, page-key, anchor build + resolution, validation, preferences
├── storage/      # NotesRepository + PreferencesRepository over chrome.storage.local
├── content/      # HameshApp (React orchestrator), theme detection, navigation, positioning
├── ui/           # React components + design tokens (Composer, NoteViewer, Marker, …)
├── messaging/    # Runtime message types
└── entrypoints/  # WXT entrypoints: content (Shadow DOM mount), background, popup
```

All page UI is rendered by one React app inside a single Shadow DOM root, so
Hamesh's styles are isolated from — and don't leak into — the host page. See
[docs/architecture.md](docs/architecture.md).

## Local development

```bash
pnpm install
pnpm dev            # WXT dev server with hot reload
```

## Build & load in Chrome

```bash
pnpm build          # output → .output/chrome-mv3/
```

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select `.output/chrome-mv3/`
4. On any page, click the Hamesh toolbar icon or press **Alt+H**, then click an
   element and write a note.

## Testing

```bash
pnpm test           # unit + integration (Vitest)
pnpm test:e2e       # end-to-end against the real extension UI (Playwright)
pnpm check          # typecheck + lint + format:check + unit tests + build
```

E2E notes: the suite builds the extension, serves a fixture over HTTP (content
scripts don't run on `file://`), and launches Chromium with `--headless=new`
(the legacy headless mode can't load extensions). It exercises the full
select → compose → save → reload → restore → edit → delete flow. E2E is excluded
from CI (it needs a real Chromium and a display-capable headless mode); run it
locally with `pnpm test:e2e`.

## Localization & direction

UI chrome and layout direction follow the extension's locale by default
(`ar` → RTL Arabic, otherwise LTR English), independent of the host page —
or an explicit language chosen from the popup's **Settings** screen, which
persists and applies live across every open tab. Note _content_ uses
`dir="auto"`, so mixed Arabic/English text lays out correctly either way.

## Appearance

Hamesh's own UI (popup, markers, composer, viewer) has three appearance
modes, chosen from **Settings**: **Match website** (default — adaptively
picks light/dark from the host page's background, same behavior Hamesh has
always had), **Light**, and **Dark**. A forced choice always wins regardless
of the host page; the host page itself is never modified, and Hamesh's
styling stays isolated in its own Shadow DOM root either way. Like language,
the choice persists and applies live across every open tab. See
[docs/architecture.md](docs/architecture.md#theme-detection-srccontentthemets)
for the detection algorithm.

## Known MVP limitations

- Local only — no cloud sync, no cross-device replication, no export/import.
- Plain-text notes; no rich text or Markdown.
- SPA support is generic (`pushState`/`replaceState`/`popstate`); no
  framework-router integration.
- Text-snippet anchoring is exact (no fuzzy matching).
- Multiple notes on the exact same element stack as separate markers; the
  grouped “count badge” from the design is not yet wired.
- Bundled fonts fall back to system faces; production should self-host the
  IBM Plex subset (see docs/architecture.md).

## Privacy

All notes are stored locally via `chrome.storage.local`. No backend, no
accounts, no analytics, no telemetry, no network requests of any kind. See
[PRIVACY.md](PRIVACY.md).

## Releases

Semantic Versioning; releases are cut from `main` by pushing a `vMAJOR.MINOR.PATCH`
tag, which builds and publishes the packaged extension via GitHub Actions. See
[docs/RELEASING.md](docs/RELEASING.md) and [CHANGELOG.md](CHANGELOG.md).

## Documentation

- [docs/architecture.md](docs/architecture.md) — runtime contexts, data flow, anchoring, SPA, testing.
- [docs/RELEASING.md](docs/RELEASING.md) — versioning and release process.
- [docs/releases/CHROME_WEB_STORE_AUTOMATION.md](docs/releases/CHROME_WEB_STORE_AUTOMATION.md) — Chrome Web Store submission automation architecture and setup.
- [docs/PROMPT.md](docs/PROMPT.md) — original MVP engineering specification.
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [PRIVACY.md](PRIVACY.md)

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE). This is **not**
open-source software.

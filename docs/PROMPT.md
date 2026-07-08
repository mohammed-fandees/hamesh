# Project Mission: Build the Production-Grade MVP Foundation for "Hamesh"

You are acting as the lead engineer and technical architect for a new browser extension called **Hamesh**.

Hamesh is a contextual notes layer for the web.

Its core idea is simple:

> A user can attach a note to a specific place on a web page, leave the page, return later, and find the note restored in the correct context.

The goal of this task is NOT to build the full product vision.

The goal is to build a small, polished, technically sound MVP that proves the core interaction while establishing a maintainable foundation for future development.

Do not over-engineer the product, but do not build throwaway prototype code either.

---

# 1. Product Scope

The MVP must support one complete core flow:

1. The user visits a normal web page.
2. The user activates "Add Note" mode from the extension action or a keyboard shortcut.
3. The page enters element-selection mode.
4. Hovering over eligible page elements shows a non-destructive visual highlight overlay.
5. Clicking an element opens a small note composer anchored near that element.
6. The user writes plain text and saves the note.
7. The note is persisted locally.
8. The note is represented on the page by a small unobtrusive marker.
9. Clicking the marker opens the note.
10. The user can edit or delete the note.
11. After refreshing or revisiting the same page, the note is restored and attached to the original element when possible.

That is the MVP.

Everything else is explicitly out of scope unless technically required for the core flow.

---

# 2. Explicit Non-Goals

Do NOT implement:

- authentication;
- user accounts;
- backend services;
- cloud synchronization;
- AI features;
- team collaboration;
- note sharing;
- comments or threads;
- rich text editors;
- Markdown rendering;
- attachments;
- screenshots;
- tags;
- folders;
- semantic search;
- analytics;
- payment or subscriptions;
- Firefox-specific optimization unless it comes nearly free through the selected framework;
- a full notes dashboard;
- a complex side panel;
- URL pattern rules;
- cross-device sync.

Do not add speculative abstractions for these features.

Design clean extension points where appropriate, but optimize the current implementation for the actual MVP.

---

# 3. Required Technology Stack

Use:

- WXT as the browser extension framework;
- Manifest V3;
- React;
- TypeScript with strict mode enabled;
- Tailwind CSS for extension-owned UI only;
- Vitest for unit and integration tests;
- React Testing Library where React component behavior needs testing;
- Playwright for a minimal extension E2E smoke suite;
- ESLint;
- Prettier;
- pnpm as package manager.

Before implementation, inspect the current stable documentation and APIs of the selected tools.

Do not blindly use deprecated APIs or old browser-extension patterns.

Use WXT conventions instead of manually recreating infrastructure already provided by WXT.

---

# 4. Architecture Principles

The architecture should clearly separate:

## Domain Layer

Pure TypeScript logic with no direct dependency on React or browser APIs.

Responsibilities:

- note entity types;
- anchor model;
- URL normalization;
- anchor candidate generation;
- anchor resolution;
- validation rules.

## Storage Layer

A small repository abstraction around extension local storage.

Example conceptual interface:

```ts
interface NotesRepository {
  getForPage(pageKey: string): Promise<Note[]>;
  create(note: Note): Promise<void>;
  update(note: Note): Promise<void>;
  delete(noteId: string): Promise<void>;
}
```

Do not leak raw browser storage calls throughout the application.

Use local extension storage only.

## Content Script Layer

Responsible for:

- selection mode;
- hover overlay;
- element picking;
- marker rendering;
- note restoration;
- responding to navigation changes in SPAs where reasonably possible;
- communication with extension-owned UI and storage.

## UI Layer

Responsible for:

- note composer;
- note viewer/editor;
- marker;
- minimal extension action UI if needed.

Keep business rules outside React components.

---

# 5. Note Data Model

Design a versioned data model.

A note should conceptually contain:

```ts
interface Note {
  id: string;
  schemaVersion: 1;

  pageKey: string;
  originalUrl: string;

  content: string;

  anchor: ElementAnchor;

  createdAt: string;
  updatedAt: string;
}
```

The exact implementation can improve on this structure, but explain meaningful deviations.

The anchor must not rely only on absolute x/y coordinates.

Use a pragmatic multi-signal anchor strategy suitable for an MVP.

Suggested anchor information:

```ts
interface ElementAnchor {
  primarySelector: string | null;

  signals: {
    testId?: string;
    id?: string;
    ariaLabel?: string;
    textSnippet?: string;
    tagName: string;
  };

  fallbackDocumentPosition: {
    x: number;
    y: number;
  };
}
```

Avoid storing unnecessary page content.

Never store passwords or input values.

---

# 6. Anchor Resolution Strategy

Implement a small deterministic anchor resolution pipeline.

When restoring a note, attempt resolution approximately in this priority order:

1. stable `data-testid`, when present and unique;
2. stable unique element ID;
3. accessible attributes such as `aria-label`, when sufficiently specific;
4. generated CSS selector;
5. tag + normalized text snippet matching;
6. fallback document position.

The implementation must:

- score or prioritize candidates deterministically;
- avoid throwing when the page structure changed;
- return a clear resolution result;
- distinguish exact, probable, fallback, and unresolved results if useful;
- be independently unit-testable.

Do not build a complex fuzzy matching engine in this MVP.

The objective is a strong simple baseline.

---

# 7. Element Selection Mode

Implement element selection professionally.

Requirements:

- Do not mutate hovered page elements by setting inline styles.
- Use extension-owned overlay elements.
- Overlay UI must not permanently alter host-page layout.
- Extension UI should be isolated from host page CSS as much as practical.
- Prefer Shadow DOM for injected extension UI if compatible with the chosen architecture.
- Ensure extension UI has a deliberate z-index strategy.
- Escape exits selection mode.
- Clicking outside or cancelling should clean up listeners and overlays.
- Event listeners must be cleaned up correctly.
- Selection mode must not accidentally trigger the underlying page element's normal action.

Handle common cases gracefully:

- nested elements;
- links;
- buttons;
- scroll;
- resize;
- sticky elements;
- dynamic DOM updates.

Do not attempt to support browser-internal pages or pages where extensions cannot legally inject scripts.

---

# 8. Page Identity

Create a clear page-key strategy.

For MVP:

- normalize protocol, host, pathname, and meaningful query behavior;
- remove URL fragments by default;
- document the decision about query parameters;
- keep normalization logic isolated and tested.

Do not create an overly complex URL pattern system.

The behavior should be predictable.

---

# 9. SPA Support

Provide lightweight SPA navigation awareness.

At minimum, notes should re-evaluate when:

- history navigation occurs;
- `pushState` or `replaceState` changes the effective page;
- `popstate` occurs.

Keep this implementation small and well-contained.

Do not build a full framework-specific router integration system.

---

# 10. UI and UX Requirements

This task is engineering-first, not a full visual design task.

Create a clean neutral placeholder UI that can later be replaced by the final design system.

The UI should feel intentional, not like browser default controls.

Required states:

- inactive;
- selection mode active;
- note composer;
- saved marker;
- note open;
- editing;
- delete confirmation;
- empty content validation;
- storage failure feedback.

Accessibility requirements:

- keyboard-accessible controls;
- visible focus states;
- semantic buttons;
- meaningful ARIA labels;
- Escape behavior where appropriate;
- do not rely only on color to communicate state.

Do not spend excessive time creating a visual brand. A separate design process will define the identity.

---

# 11. Testing Strategy

Testing is a first-class requirement.

Do not chase arbitrary coverage percentages.

Test behavior and important invariants.

## Unit Tests

At minimum, cover:

- URL normalization;
- page-key generation;
- selector generation;
- anchor candidate generation;
- anchor resolution priority;
- duplicate IDs or ambiguous candidates;
- text normalization;
- fallback behavior;
- note validation;
- repository serialization/deserialization.

## Integration Tests

Test important flows involving multiple modules where practical:

- create note → persist → load for page;
- anchor element → serialize anchor → resolve anchor;
- update note;
- delete note;
- page identity changes.

Mock browser APIs at the boundary, not throughout domain logic.

## E2E Tests

Create a minimal Playwright extension test setup.

At minimum, prove these critical flows against a deterministic local fixture page:

### E2E 1 — Persistence

1. Load the unpacked extension.
2. Open the fixture page.
3. Activate add-note mode.
4. Select a known fixture element.
5. Create a note.
6. Verify marker appears.
7. Reload the page.
8. Verify the marker is restored.
9. Open it and verify content.

### E2E 2 — Edit and Delete

1. Create a note.
2. Open it.
3. Edit its content.
4. Reload.
5. Verify updated content persists.
6. Delete the note.
7. Reload.
8. Verify it no longer appears.

If browser-extension automation makes a specific activation method unreliable, expose a deterministic test-only activation mechanism without compromising production behavior. Document it clearly.

---

# 12. Development Quality Gates

Configure scripts for:

- dev;
- build;
- typecheck;
- lint;
- format check;
- unit tests;
- E2E tests;
- all checks.

The repository should pass:

1. TypeScript strict typecheck;
2. ESLint;
3. formatting check;
4. unit and integration tests;
5. production build.

Run all checks before considering the task complete.

Do not leave known failing tests.

Do not disable rules merely to make CI green unless there is a documented technical reason.

---

# 13. CI

Add a small GitHub Actions workflow that runs on pull requests and pushes to the main development branch.

CI should run:

- dependency installation with lockfile enforcement;
- typecheck;
- lint;
- format check;
- unit tests;
- production build.

Only add Playwright E2E to CI if the setup is reliable and does not introduce unnecessary complexity. If E2E is intentionally excluded from initial CI, document the exact reason and the command to run it locally.

Use dependency caching appropriately.

---

# 14. Documentation

Create a concise but useful README containing:

- what Hamesh is;
- MVP scope;
- technology stack;
- architecture overview;
- local development instructions;
- how to load the extension in Chrome;
- testing commands;
- known MVP limitations;
- privacy statement explaining that notes are stored locally and no backend exists.

Also create:

`docs/architecture.md`

It should explain:

- runtime contexts in the extension;
- data flow;
- storage boundary;
- anchoring strategy;
- page identity strategy;
- SPA navigation handling;
- testing strategy;
- known limitations and logical future extension points.

Keep documentation factual and aligned with the actual implementation.

---

# 15. Privacy and Security Requirements

The extension should follow least-privilege principles.

Before adding every permission:

1. verify that it is actually required;
2. prefer narrower permissions;
3. document why it exists.

Do not:

- collect browsing history;
- send data to external services;
- use remote scripts;
- store form values;
- inspect password fields;
- log note contents to console in production;
- request permissions unrelated to the MVP.

Add a short privacy document if appropriate.

---

# 16. Implementation Process

Follow this sequence:

## Phase A — Inspect and Plan

Before changing files:

1. inspect the repository;
2. determine whether it is empty or contains existing work;
3. inspect package manager and configuration;
4. produce a concise implementation plan;
5. identify technical risks.

Do not overwrite useful existing work without understanding it.

## Phase B — Foundation

Set up:

- WXT;
- React;
- strict TypeScript;
- Tailwind;
- linting;
- formatting;
- testing.

Verify the basic extension builds and loads.

## Phase C — Domain and Storage

Implement:

- note model;
- page identity;
- anchor generation;
- anchor resolution;
- repository abstraction;
- unit tests.

## Phase D — Core Interaction

Implement:

- activation;
- selection overlay;
- composer;
- save;
- marker rendering;
- open/edit/delete;
- restoration.

## Phase E — Robustness

Implement:

- navigation handling;
- scroll and resize behavior;
- cleanup;
- basic error handling;
- accessibility pass.

## Phase F — Testing and Documentation

Complete:

- unit tests;
- integration tests;
- two critical E2E flows;
- CI;
- README;
- architecture documentation.

---

# 17. Definition of Done

The project is complete only when:

- a user can attach a note to an element;
- the note survives reload;
- the note restores near the intended element;
- the note can be opened, edited, and deleted;
- the extension does not visibly break the host page;
- the code has clear architectural boundaries;
- important pure logic is unit tested;
- the two core browser flows have E2E coverage;
- typecheck passes;
- lint passes;
- tests pass;
- production build succeeds;
- permissions are minimal;
- documentation matches reality.

---

# 18. Important Engineering Behavior

Do not prematurely build future features.

Do not replace architecture with a single giant content script.

Do not put all browser API calls directly inside React components.

Do not use absolute page coordinates as the only anchoring strategy.

Do not use inline styles on host-page elements for hover highlighting.

Do not use broad permissions without justification.

Do not create unnecessary backend infrastructure.

Do not introduce AI.

Do not silently skip tests because browser extensions are inconvenient to test.

When a design decision is ambiguous, choose the smallest maintainable solution that preserves a clean path forward.

At the end, provide:

1. a concise implementation summary;
2. architecture decisions made;
3. files and modules added;
4. test results;
5. build/typecheck/lint status;
6. known limitations;
7. recommended next three product steps, without implementing them.

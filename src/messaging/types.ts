/**
 * Runtime messages. Note CRUD lives in the content script (it owns the page
 * context and pageKey), so messaging is deliberately small: activate selection
 * mode, report how many notes exist on the active tab's page, and the
 * Notes Library's "open note" handshake (see docs/architecture.md).
 */
export type HameshMessage =
  | { type: 'ENABLE_SELECTION' }
  | { type: 'ENABLE_VIDEO_NOTE' }
  | { type: 'GET_PAGE_STATE' }
  | { type: 'CONTENT_READY' }
  | { type: 'RESTORE_NOTE'; noteId: string }
  | { type: 'GET_SHORTCUTS' };

export interface PageStateResponse {
  type: 'PAGE_STATE';
  count: number;
}

/** `chrome.commands` is not available in a content script's execution
 *  context (Chrome restricts it to background/extension pages) — this is
 *  how the content script's `keydown` listener (see content.ts) learns the
 *  user's actual configured shortcut bindings instead. */
export interface ShortcutsResponse {
  type: 'SHORTCUTS';
  addNote: string | null;
  addVideoNote: string | null;
}

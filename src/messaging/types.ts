/**
 * Runtime messages. Note CRUD lives in the content script (it owns the page
 * context and pageKey), so messaging is deliberately small: activate selection
 * mode, report how many notes exist on the active tab's page, and the
 * Notes Library's "open note" handshake (see docs/architecture.md).
 */
export type HameshMessage =
  | { type: 'ENABLE_SELECTION' }
  | { type: 'GET_PAGE_STATE' }
  | { type: 'CONTENT_READY' }
  | { type: 'RESTORE_NOTE'; noteId: string };

export interface PageStateResponse {
  type: 'PAGE_STATE';
  count: number;
}

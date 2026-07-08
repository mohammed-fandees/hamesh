/**
 * Runtime messages. Note CRUD lives in the content script (it owns the page
 * context and pageKey), so messaging is deliberately small: activate selection
 * mode, and report how many notes exist on the active tab's page.
 */
export type HameshMessage = { type: 'ENABLE_SELECTION' } | { type: 'GET_PAGE_STATE' };

export interface PageStateResponse {
  type: 'PAGE_STATE';
  count: number;
}

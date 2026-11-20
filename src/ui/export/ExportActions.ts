import { createContext, useContext } from 'react';
import type { ExportScope } from '@/domain/export/model';

/**
 * What the Library's menus and Settings can ask of the Markdown export, without knowing how it
 * is built. Provided by the Notes page; absent anywhere else, so a surface without it simply
 * offers no export.
 */
export interface ExportActions {
  /** Opens the export dialog for a page, a folder or everything. */
  open: (scope: ExportScope) => void;
  /** Copies one page's notes, in the remembered tool and layout. Resolves to whether it worked. */
  copyPage: (pageId: string) => Promise<boolean>;
}

export const ExportActionsContext = createContext<ExportActions | null>(null);

export function useExportActions(): ExportActions | null {
  return useContext(ExportActionsContext);
}

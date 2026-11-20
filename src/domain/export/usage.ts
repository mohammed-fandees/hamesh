import type { ExportFlavor } from '../preferences';
import type { FeatureEvent } from '../usage';
import type { ExportModel } from './model';
import { layoutFor, type RenderOptions } from './render';

/**
 * What one finished export counts (only for a reader who shares usage counts):
 * the tool, the scope, each layout its pages were drawn in, and whether it was
 * copied rather than downloaded. Nothing about the notes, pages or folders.
 */
export function exportEvents(
  model: ExportModel,
  flavor: ExportFlavor,
  layouts: RenderOptions['layouts'],
  how: 'download' | 'copy',
): FeatureEvent[] {
  const events: FeatureEvent[] = [flavor === 'notion' ? 'export.notion' : 'export.obsidian'];
  events.push(`export.scope.${model.scope.kind}`);
  if (how === 'copy') events.push('export.copied');
  const used = new Set(
    model.groups
      .filter((group) => group.pageIds.length > 0)
      .map((group) => layoutFor(model, group.key, layouts)),
  );
  for (const layout of used) events.push(`export.layout.${layout}`);
  return events;
}

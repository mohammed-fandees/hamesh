import { mermaidLabel } from './text';

/**
 * The three diagrams an export draws. Every label goes through `mermaidLabel`, and every id is
 * generated here, never taken from someone's text, so no note can break or steer a diagram.
 */

export interface DiagramItem {
  label: string;
}

export interface DiagramSection {
  title: string | null;
  items: DiagramItem[];
}

function fence(lines: string[]): string {
  return ['```mermaid', ...lines, '```'].join('\n');
}

/** A page as a mind map: the page in the middle, sections around it, notes on the sections. */
export function mindmap(title: string, sections: DiagramSection[]): string {
  const lines = ['mindmap', `  root((${mermaidLabel(title, 40)}))`];
  let n = 0;
  sections.forEach((section, s) => {
    const depth = section.title ? 6 : 4;
    if (section.title) lines.push(`    s${s + 1}[${mermaidLabel(section.title, 40)}]`);
    for (const item of section.items) {
      n += 1;
      lines.push(`${' '.repeat(depth)}n${n}(${mermaidLabel(item.label)})`);
    }
  });
  return fence(lines);
}

/** Moments in order, top to bottom, boxed by chapter when chapters are known. */
export function timeline(sections: DiagramSection[]): string {
  const lines = ['flowchart TB'];
  const ids: string[] = [];
  let n = 0;
  sections.forEach((section, s) => {
    const indent = section.title ? '    ' : '  ';
    if (section.title)
      lines.push(`  subgraph c${s + 1}["${mermaidLabel(section.title, 40)}"]`, '    direction TB');
    for (const item of section.items) {
      n += 1;
      lines.push(`${indent}n${n}["${mermaidLabel(item.label)}"]`);
      ids.push(`n${n}`);
    }
    if (section.title) lines.push('  end');
  });
  for (let i = 1; i < ids.length; i++) lines.push(`  ${ids[i - 1]} --> ${ids[i]}`);
  return fence(lines);
}

export function pie(title: string, slices: { label: string; value: number }[]): string {
  return fence([
    'pie showData',
    `  title ${mermaidLabel(title, 40)}`,
    ...slices.map((s) => `  "${mermaidLabel(s.label, 40)}" : ${s.value}`),
  ]);
}

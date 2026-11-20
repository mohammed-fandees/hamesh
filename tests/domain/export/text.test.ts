import { describe, it, expect } from 'vitest';
import {
  escapeBlock,
  escapeCell,
  truncateWords,
  yamlString,
  mermaidLabel,
  linkAlias,
  dominantScript,
  wordCount,
} from '@/domain/export/text';
import { blockId, closeFences } from '@/domain/export/text';

describe('closeFences', () => {
  it('closes a fence the note leaves open, with the same marker', () => {
    expect(closeFences('a\n````\ncode')).toBe('a\n````\ncode\n````');
    expect(closeFences('~~~\nx')).toBe('~~~\nx\n~~~');
  });

  it('leaves closed fences and inline backticks alone', () => {
    expect(closeFences('```\nx\n```')).toBe('```\nx\n```');
    expect(closeFences('use `x` here')).toBe('use `x` here');
    expect(closeFences('```\n~~~\n```')).toBe('```\n~~~\n```');
  });
});

describe('blockId', () => {
  it('is short, lower case and made only of letters and digits', () => {
    expect(blockId('3F2A-91bc-0000')).toBe('hm-3f2a91bc');
  });
});

describe('escapeBlock', () => {
  it('keeps a note that is just "#2" as text', () => {
    expect(escapeBlock('#2')).toBe('\\#2');
  });

  it('escapes every line that would become structure, and only those', () => {
    const input = [
      '# not a heading',
      '> not a quote',
      '- not a list',
      '1. not a list',
      '---',
      'fine',
    ];
    expect(escapeBlock(input.join('\n')).split('\n')).toEqual([
      '\\# not a heading',
      '\\> not a quote',
      '\\- not a list',
      '\\1. not a list',
      '\\---',
      'fine',
    ]);
  });

  it('leaves Arabic text and line breaks as written', () => {
    expect(escapeBlock('بديهي - واضح\nجَلِي')).toBe('بديهي - واضح\nجَلِي');
  });
});

describe('escapeCell', () => {
  it('folds line breaks and escapes pipes', () => {
    expect(escapeCell('a | b\n  c')).toBe('a \\| b c');
  });
});

describe('truncateWords', () => {
  it('leaves short text alone', () => {
    expect(truncateWords('short  text', 20)).toBe('short text');
  });

  it('cuts on a word boundary and marks the cut', () => {
    const cut = truncateWords('This is the default api contract in useEffect', 30);
    expect(cut).toBe('This is the default api…');
    expect(cut.length).toBeLessThanOrEqual(30);
  });

  it('cuts a single long word where it must', () => {
    expect(truncateWords('x'.repeat(50), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('yamlString', () => {
  it('keeps values that YAML would otherwise read as other types as strings', () => {
    expect(yamlString('yes')).toBe('"yes"');
    expect(yamlString('Yes: no #1')).toBe('"Yes: no #1"');
    expect(yamlString('say "hi"')).toBe('"say \\"hi\\""');
  });
});

describe('mermaidLabel', () => {
  it('drops characters that open shapes or comments', () => {
    expect(mermaidLabel('connection.disconnect(); "quoted" [x] #tag')).toBe(
      'connection.disconnect quoted x tag',
    );
  });

  it('keeps Arabic and is never empty', () => {
    expect(mermaidLabel('intend → ينوي')).toBe('intend → ينوي');
    expect(mermaidLabel('()')).toBe('·');
  });
});

describe('linkAlias', () => {
  it('never carries a pipe or a bracket', () => {
    expect(linkAlias('صيد كاست 13 | حوار [جريء]')).toBe('صيد كاست 13 – حوار جريء');
  });
});

describe('dominantScript', () => {
  it('tells Arabic from Latin text', () => {
    expect(dominantScript('مُريح')).toBe('arabic');
    expect(dominantScript('comfy')).toBe('latin');
    expect(dominantScript('#2')).toBe('none');
  });
});

describe('wordCount', () => {
  it('counts words in either script', () => {
    expect(wordCount('طُوال - أو في كل مكان')).toBe(6);
    expect(wordCount('  ')).toBe(0);
  });
});

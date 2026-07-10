/**
 * Cuts the Clip 4 micro-montage from the already-recorded, already-upscaled
 * clips 1-3, using the millisecond-precise beat timestamps record.mjs logged
 * alongside each clip — real trimmed footage, not staged, with data-driven
 * (not eyeballed) cut points.
 *
 * Usage: node tooling/launch-video/montage.mjs (run after record.mjs)
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const RAW_DIR = path.resolve(ROOT, 'artifacts', 'launch-video', 'raw');
const FFMPEG = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'ms-playwright',
  'ffmpeg-1011',
  'ffmpeg-win64.exe',
);

function beatsOf(clipBaseName) {
  const raw = fs.readFileSync(path.join(RAW_DIR, `${clipBaseName}.beats.json`), 'utf8');
  const beats = JSON.parse(raw);
  const at = (label) => {
    const b = beats.find((x) => x.label === label);
    if (!b) throw new Error(`beat "${label}" not found in ${clipBaseName}`);
    return b.tMs / 1000;
  };
  return at;
}

function cut(sourceBaseName, startSec, endSec, outName) {
  const src = path.join(RAW_DIR, `${sourceBaseName}.webm`);
  const out = path.join(RAW_DIR, outName);
  execFileSync(FFMPEG, [
    '-y',
    '-i',
    src,
    '-ss',
    startSec.toFixed(2),
    '-to',
    endSec.toFixed(2),
    '-c:v',
    'libvpx',
    '-crf',
    '10',
    '-b:v',
    '2M',
    '-an',
    out,
  ]);
  console.log(`cut ${outName}  (${(endSec - startSec).toFixed(2)}s from ${sourceBaseName})`);
}

const c1 = beatsOf('01-activation-select-write-save');
const c2 = beatsOf('02-return-and-restore');
const c3 = beatsOf('03-edit-note');

// Selection outline gliding from one candidate paragraph to the next.
cut(
  '01-activation-select-write-save',
  c1('hover-p1'),
  c1('hover-p2-intended'),
  '04-montage-selection.webm',
);

// Cursor arrives at Save, click, marker pops in — a beat of hold after.
cut(
  '01-activation-select-write-save',
  c1('typing-done') + 0.3,
  Math.min(c1('marker-visible') + 0.6, c1('marker-visible') + 0.6),
  '05-montage-marker.webm',
);

// Approach the restored marker, click, note opens, brief hold.
cut(
  '02-return-and-restore',
  c2('marker-restored') + 1.6,
  c2('note-open') + 1.0,
  '06-montage-restored-note.webm',
);

// Bonus beyond the minimum ask: the edit state appearing.
cut('03-edit-note', c3('edit-clicked'), c3('edit-clicked') + 1.1, '07-montage-edit.webm');

console.log('\nMontage clips written to', RAW_DIR);

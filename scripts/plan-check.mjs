#!/usr/bin/env node
// Lists every unfinished task in a plan folder, so nothing is forgotten before a phase or a
// release is called done. A task is a Markdown checkbox line: `- [ ] …` (open) or `- [x] …`.
//
// Usage: node scripts/plan-check.mjs <plan-dir> [--part=03]
// Exit code 0 when every task in scope is ticked, 1 otherwise.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [dir, ...flags] = process.argv.slice(2);
if (!dir) {
  console.error('Usage: node scripts/plan-check.mjs <plan-dir> [--part=NN]');
  process.exit(2);
}
const part = flags.find((f) => f.startsWith('--part='))?.slice('--part='.length);

function markdownFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const full = join(root, name);
    if (statSync(full).isDirectory()) return markdownFiles(full);
    return name.endsWith('.md') ? [full] : [];
  });
}

const files = markdownFiles(dir)
  .filter((file) => !part || relative(dir, file).startsWith(part))
  .sort();

let done = 0;
const open = [];
for (const file of files) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const match = line.match(/^\s*[-*] \[( |x|X)\] (.*)$/);
      if (!match) return;
      if (match[1] === ' ') open.push(`${relative(process.cwd(), file)}:${index + 1}  ${match[2]}`);
      else done++;
    });
}

const total = done + open.length;
console.log(`${done}/${total} tasks done in ${files.length} file(s).`);
if (open.length > 0) {
  console.log('\nStill open:');
  for (const line of open) console.log(`  ${line}`);
  process.exit(1);
}

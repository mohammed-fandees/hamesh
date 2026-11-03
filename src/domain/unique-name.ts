/** Two names a person would read as the same one: case and spacing don't count. */
function comparable(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function nameTaken(name: string, taken: readonly string[]): boolean {
  const wanted = comparable(name);
  return taken.some((other) => comparable(other) === wanted);
}

/**
 * The first free "Name (N)", the way Windows names a second folder: "Design"
 * becomes "Design (2)", and "Design (2)" becomes "Design (3)" rather than
 * "Design (2) (2)". The name is cut back, never the number, when it would
 * otherwise run past `maxLength`.
 */
export function nextFreeName(name: string, taken: readonly string[], maxLength: number): string {
  const numbered = /^(.*\S)\s*\((\d+)\)$/.exec(name.trim());
  const base = numbered ? numbered[1] : name.trim();
  for (let n = numbered ? Number(numbered[2]) + 1 : 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
    if (!nameTaken(candidate, taken)) return candidate;
  }
}

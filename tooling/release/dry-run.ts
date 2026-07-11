/**
 * Whether the current invocation should validate and report without performing any mutation.
 * PR1 ships no mutating operations at all (no CWS API calls exist yet), so every command here
 * is already dry-run-safe by construction — this flag exists so the CLI surface is stable once
 * PR3 adds upload/publish commands that do need to honor it.
 */
export function isDryRun(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (argv.includes('--dry-run')) return true;
  const value = env.DRY_RUN?.toLowerCase();
  return value === 'true' || value === '1';
}

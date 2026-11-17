import { parseLedger, type UsageLedger } from '@/domain/usage';

/** This device's counts. Only the background writes it; pages read it. */
export const LEDGER_KEY = 'local:hamesh:usage';

export async function readLedger(now: number): Promise<UsageLedger> {
  return parseLedger(await storage.getItem<unknown>(LEDGER_KEY), now);
}

export function writeLedger(ledger: UsageLedger): Promise<void> {
  return storage.setItem(LEDGER_KEY, ledger);
}

/** Forgets every count kept on this device. */
export function clearLedger(): Promise<void> {
  return storage.removeItem(LEDGER_KEY);
}

export function watchLedger(onChange: (ledger: UsageLedger) => void): () => void {
  return storage.watch<unknown>(LEDGER_KEY, (value) => onChange(parseLedger(value, Date.now())));
}

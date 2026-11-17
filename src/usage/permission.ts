import { browser } from 'wxt/browser';

/**
 * Firefox's own consent for what an add-on sends: "Technical and interaction
 * data", declared optional in the manifest (wxt.config.ts). Firefox asks the
 * reader itself, and Hamesh shares nothing unless both that and the switch in
 * Settings say yes. Other browsers have no such permission: the switch is the
 * whole consent there.
 */
const DATA_COLLECTION = { data_collection: ['technicalAndInteraction'] };

type Permissions = Parameters<typeof browser.permissions.request>[0];
const permission = DATA_COLLECTION as unknown as Permissions;

/**
 * Asks Firefox, which only shows its prompt for a click: call this first in the
 * click's own handler, before anything is awaited.
 */
export function requestSharingPermission(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return Promise.resolve(true);
  return browser.permissions.request(permission).catch(() => false);
}

export async function hasSharingPermission(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return true;
  return browser.permissions.contains(permission).catch(() => false);
}

/** Gives the permission back when the reader turns sharing off. */
export async function releaseSharingPermission(): Promise<void> {
  if (!import.meta.env.FIREFOX) return;
  await browser.permissions.remove(permission).catch(() => false);
}

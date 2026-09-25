// Notifications contain no secrets. Nothing is placed in Web Storage.
export const LOCK_EVENT = "rounza-vault-lock";
export const LOCK_CHANNEL = "rounza-vault-lock-v1";
export const IDLE_MS = 5 * 60 * 1000;
let source: string | undefined;
export function lockSource() {
  return (source ??= crypto.randomUUID());
}
export function broadcastVaultLock() {
  window.dispatchEvent(new Event(LOCK_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(LOCK_CHANNEL);
    channel.postMessage({ type: "lock", source: lockSource() });
    channel.close();
  }
}

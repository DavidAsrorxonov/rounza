import type { DeriveKey } from "./crypto";
export function browserDeriver(signal: AbortSignal): DeriveKey {
  return (passphrase, salt) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error("Vault locked."));
        return;
      }
      const worker = new Worker(new URL("./argon.worker.ts", import.meta.url), {
        type: "module",
      });
      const finish = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        worker.terminate();
      };
      const abort = () => {
        finish();
        reject(new Error("Vault locked."));
      };
      const timeout = setTimeout(() => {
        finish();
        reject(new Error("Key derivation timed out."));
      }, 60000);
      signal.addEventListener("abort", abort, { once: true });
      worker.onerror = () => {
        finish();
        reject(new Error("Key derivation failed."));
      };
      worker.onmessage = (event: MessageEvent<{ key?: Uint8Array }>) => {
        finish();
        if (event.data.key?.length === 32) resolve(event.data.key);
        else reject(new Error("Key derivation failed."));
      };
      worker.postMessage({ passphrase, salt });
    });
}

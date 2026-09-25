import { argon2id } from "hash-wasm";
import { KDF } from "./model";
self.onmessage = async (
  event: MessageEvent<{ passphrase: string; salt: Uint8Array }>,
) => {
  let result: Uint8Array | undefined;
  try {
    result = await argon2id({
      password: event.data.passphrase,
      salt: event.data.salt,
      memorySize: KDF.memory_kib,
      iterations: KDF.iterations,
      parallelism: KDF.parallelism,
      hashLength: 32,
      outputType: "binary",
    });
    self.postMessage({ key: result });
  } catch {
    self.postMessage({ error: true });
  } finally {
    result?.fill(0);
    event.data.salt.fill(0);
    self.close();
  }
};

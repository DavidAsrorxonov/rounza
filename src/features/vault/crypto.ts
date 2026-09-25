// Browser cryptography only. Server modules import model.ts, never this module.
// Uint8Array buffers are cleared where possible; JS strings and CryptoKeys cannot
// be reliably zeroized. No keys, plaintext or recovery secrets go into storage.
import {
  encryptedPortal,
  portalDetails,
  vaultEnvelope,
  KDF,
  passphraseInput,
  type VaultEnvelope,
  type PortalDetails,
  type EncryptedPortal,
} from "./model";
export type DeriveKey = (
  passphrase: string,
  salt: Uint8Array,
) => Promise<Uint8Array>;
const encoder = new TextEncoder();
export function toBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}
export function fromBase64(value: string) {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  if (toBase64(bytes) !== value) throw new Error("Invalid encoded data.");
  return bytes;
}
const random = (length: number) =>
  crypto.getRandomValues(new Uint8Array(length));
const aad = (owner: string, vaultId: string, purpose: string) =>
  encoder.encode(`rounza:v1:${owner}:${vaultId}:${purpose}`);
async function aesKey(raw: Uint8Array) {
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(raw),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}
async function encrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  context: Uint8Array,
) {
  const iv = random(12);
  const result = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new Uint8Array(context),
      tagLength: 128,
    },
    key,
    new Uint8Array(plaintext),
  );
  return { nonce: toBase64(iv), ciphertext: toBase64(new Uint8Array(result)) };
}
async function decrypt(
  key: CryptoKey,
  nonce: string,
  ciphertext: string,
  context: Uint8Array,
) {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64(nonce),
        additionalData: new Uint8Array(context),
        tagLength: 128,
      },
      key,
      fromBase64(ciphertext),
    ),
  );
}
function recoveryCode(raw: Uint8Array) {
  return `RZ1-${toBase64(raw).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
}
function parseRecoveryCode(code: string) {
  const clean = code.replace(/\s/g, "");
  if (!/^RZ1-[A-Za-z0-9_-]{43}$/.test(clean))
    throw new Error("Check your recovery key.");
  return fromBase64(
    clean.slice(4).replaceAll("-", "+").replaceAll("_", "/") + "=",
  );
}
async function wrapDataKey(
  raw: Uint8Array,
  passphrase: string,
  owner: string,
  vaultId: string,
  derive: DeriveKey,
) {
  passphraseInput.parse(passphrase);
  const salt = random(16),
    recovery = random(32);
  let derived: Uint8Array | undefined;
  try {
    derived = await derive(passphrase, salt);
    const pass = await encrypt(
      await aesKey(derived),
      raw,
      aad(owner, vaultId, "passphrase"),
    );
    const rescue = await encrypt(
      await aesKey(recovery),
      raw,
      aad(owner, vaultId, "recovery"),
    );
    return {
      envelope: vaultEnvelope.parse({
        version: 1,
        ...KDF,
        salt: toBase64(salt),
        passphrase_nonce: pass.nonce,
        passphrase_wrapped_key: pass.ciphertext,
        recovery_nonce: rescue.nonce,
        recovery_wrapped_key: rescue.ciphertext,
      }),
      recoveryCode: recoveryCode(recovery),
      key: await aesKey(raw),
    };
  } finally {
    derived?.fill(0);
    recovery.fill(0);
  }
}
export async function createVaultKeys(
  passphrase: string,
  owner: string,
  vaultId: string,
  derive: DeriveKey,
) {
  const raw = random(32);
  try {
    return await wrapDataKey(raw, passphrase, owner, vaultId, derive);
  } finally {
    raw.fill(0);
  }
}
async function unwrap(
  envelope: VaultEnvelope,
  secret: string,
  mode: "passphrase" | "recovery",
  owner: string,
  vaultId: string,
  derive: DeriveKey,
) {
  // Exact v1 parameters are checked before the expensive KDF. Untrusted stored
  // parameters cannot request unbounded memory/iterations or a weaker algorithm.
  const parsed = vaultEnvelope.parse(envelope);
  let raw: Uint8Array | undefined;
  try {
    raw =
      mode === "recovery"
        ? parseRecoveryCode(secret)
        : await derive(secret, fromBase64(parsed.salt));
    const key = await aesKey(raw);
    return await decrypt(
      key,
      parsed[`${mode}_nonce`],
      parsed[`${mode}_wrapped_key`],
      aad(owner, vaultId, mode),
    );
  } finally {
    raw?.fill(0);
  }
}
export async function unlockVault(
  envelope: VaultEnvelope,
  passphrase: string,
  owner: string,
  vaultId: string,
  derive: DeriveKey,
) {
  const raw = await unwrap(
    envelope,
    passphrase,
    "passphrase",
    owner,
    vaultId,
    derive,
  );
  try {
    return await aesKey(raw);
  } finally {
    raw.fill(0);
  }
}
export async function replaceVaultAccess(
  envelope: VaultEnvelope,
  secret: string,
  mode: "passphrase" | "recovery",
  newPassphrase: string,
  owner: string,
  vaultId: string,
  derive: DeriveKey,
) {
  const raw = await unwrap(envelope, secret, mode, owner, vaultId, derive);
  try {
    return await wrapDataKey(raw, newPassphrase, owner, vaultId, derive);
  } finally {
    raw.fill(0);
  }
}
export async function encryptPortal(
  key: CryptoKey,
  details: PortalDetails,
  owner: string,
  vaultId: string,
  portalId: string,
): Promise<EncryptedPortal> {
  const bytes = encoder.encode(JSON.stringify(portalDetails.parse(details)));
  try {
    return encryptedPortal.parse({
      version: 1,
      ...(await encrypt(key, bytes, aad(owner, vaultId, `portal:${portalId}`))),
    });
  } finally {
    bytes.fill(0);
  }
}
export async function decryptPortal(
  key: CryptoKey,
  record: EncryptedPortal,
  owner: string,
  vaultId: string,
  portalId: string,
): Promise<PortalDetails> {
  const parsed = encryptedPortal.parse(record);
  const bytes = await decrypt(
    key,
    parsed.nonce,
    parsed.ciphertext,
    aad(owner, vaultId, `portal:${portalId}`),
  );
  try {
    return portalDetails.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } finally {
    bytes.fill(0);
  }
}

import assert from "node:assert/strict";
import test from "node:test";
import { argon2id } from "hash-wasm";
import {
  createVaultKeys,
  unlockVault,
  replaceVaultAccess,
  encryptPortal,
  decryptPortal,
  fromBase64,
  toBase64,
} from "../../src/features/vault/crypto";
import {
  KDF,
  vaultEnvelope,
  encryptedPortal,
} from "../../src/features/vault/model";
const owner = "11111111-1111-4111-8111-111111111111",
  vaultId = "22222222-2222-4222-8222-222222222222",
  portalId = "33333333-3333-4333-8333-333333333333";
const passphrase = "A long fictional test passphrase.";
const derive = (password: string, salt: Uint8Array) =>
  argon2id({
    password,
    salt,
    memorySize: KDF.memory_kib,
    iterations: KDF.iterations,
    parallelism: KDF.parallelism,
    hashLength: 32,
    outputType: "binary",
  });
const details = {
  name: "Private portal",
  url: "https://example.com/careers",
  username: "private.user@example.com",
  password: " exact password 🦉 ",
  notes: "Private note",
};

test("vault envelopes round-trip with real Argon2id and non-extractable AES keys", async () => {
  const bundle = await createVaultKeys(passphrase, owner, vaultId, derive);
  const key = await unlockVault(
    bundle.envelope,
    passphrase,
    owner,
    vaultId,
    derive,
  );
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey("raw", key));
  const record = await encryptPortal(key, details, owner, vaultId, portalId);
  assert.deepEqual(
    await decryptPortal(key, record, owner, vaultId, portalId),
    details,
  );
  assert.ok(!JSON.stringify(record).includes(details.password));
  assert.ok(!JSON.stringify(bundle.envelope).includes(passphrase));
  assert.ok(!JSON.stringify(bundle.envelope).includes(bundle.recoveryCode));
  const next = await encryptPortal(key, details, owner, vaultId, portalId);
  assert.notEqual(next.nonce, record.nonce);
  assert.notEqual(next.ciphertext, record.ciphertext);
  await assert.rejects(
    unlockVault(
      bundle.envelope,
      "incorrect passphrase",
      owner,
      vaultId,
      derive,
    ),
  );
  await assert.rejects(
    unlockVault(bundle.envelope, passphrase, "other-owner", vaultId, derive),
  );
  await assert.rejects(
    unlockVault(bundle.envelope, passphrase, owner, "other-vault", derive),
  );
  await assert.rejects(
    decryptPortal(key, record, owner, vaultId, "other-portal"),
  );
  await assert.rejects(
    decryptPortal(key, record, "other-owner", vaultId, portalId),
  );
  const bytes = fromBase64(record.ciphertext);
  bytes[0] ^= 1;
  await assert.rejects(
    decryptPortal(
      key,
      { ...record, ciphertext: toBase64(bytes) },
      owner,
      vaultId,
      portalId,
    ),
  );
});
test("recovery and passphrase changes retain data while replacing both unlock wrappers", async () => {
  const bundle = await createVaultKeys(passphrase, owner, vaultId, derive);
  const record = await encryptPortal(
    bundle.key,
    details,
    owner,
    vaultId,
    portalId,
  );
  const recovered = await replaceVaultAccess(
    bundle.envelope,
    bundle.recoveryCode,
    "recovery",
    "New fictional vault passphrase!",
    owner,
    vaultId,
    derive,
  );
  assert.notEqual(recovered.recoveryCode, bundle.recoveryCode);
  assert.notEqual(recovered.envelope.salt, bundle.envelope.salt);
  const recoveredKey = await unlockVault(
    recovered.envelope,
    "New fictional vault passphrase!",
    owner,
    vaultId,
    derive,
  );
  assert.deepEqual(
    await decryptPortal(recoveredKey, record, owner, vaultId, portalId),
    details,
  );
  await assert.rejects(
    unlockVault(recovered.envelope, passphrase, owner, vaultId, derive),
  );
  await assert.rejects(
    replaceVaultAccess(
      recovered.envelope,
      bundle.recoveryCode,
      "recovery",
      passphrase,
      owner,
      vaultId,
      derive,
    ),
  );
  const changed = await replaceVaultAccess(
    recovered.envelope,
    "New fictional vault passphrase!",
    "passphrase",
    passphrase,
    owner,
    vaultId,
    derive,
  );
  assert.deepEqual(
    await decryptPortal(changed.key, record, owner, vaultId, portalId),
    details,
  );
});
test("untrusted algorithms, parameters and malformed records fail before deriving keys", async () => {
  const bundle = await createVaultKeys(passphrase, owner, vaultId, derive);
  let called = false;
  const neverDerive = async () => {
    called = true;
    return new Uint8Array(32);
  };
  await assert.rejects(
    unlockVault(
      { ...bundle.envelope, memory_kib: 1000000 } as never,
      passphrase,
      owner,
      vaultId,
      neverDerive,
    ),
  );
  assert.equal(called, false);
  assert.equal(
    vaultEnvelope.safeParse({ ...bundle.envelope, version: 2 }).success,
    false,
  );
  assert.equal(
    vaultEnvelope.safeParse({ ...bundle.envelope, password: "plaintext" })
      .success,
    false,
  );
  assert.equal(
    encryptedPortal.safeParse({
      version: 1,
      nonce: "bad",
      ciphertext: "plaintext",
    }).success,
    false,
  );
  await assert.rejects(
    encryptPortal(
      bundle.key,
      { ...details, url: "https://user:password@example.com" },
      owner,
      vaultId,
      portalId,
    ),
  );
});

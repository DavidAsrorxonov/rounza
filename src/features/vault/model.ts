import { z } from "zod";
import { safeJobUrl } from "@/features/applications/model";
export const VAULT_PAGE_SIZE = 20;
export const KDF = {
  kdf: "argon2id",
  memory_kib: 65536,
  iterations: 3,
  parallelism: 4,
} as const;
export const nonce = z.string().regex(/^[A-Za-z0-9+/]{16}$/);
const wrappedKey = z.string().regex(/^[A-Za-z0-9+/]{64}$/);
export const vaultEnvelope = z
  .object({
    version: z.literal(1),
    kdf: z.literal(KDF.kdf),
    memory_kib: z.literal(KDF.memory_kib),
    iterations: z.literal(KDF.iterations),
    parallelism: z.literal(KDF.parallelism),
    salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
    passphrase_nonce: nonce,
    passphrase_wrapped_key: wrappedKey,
    recovery_nonce: nonce,
    recovery_wrapped_key: wrappedKey,
  })
  .strict();
export type VaultEnvelope = z.infer<typeof vaultEnvelope>;
export const encryptedPortal = z
  .object({
    version: z.literal(1),
    nonce,
    ciphertext: z
      .string()
      .min(24)
      .max(87384)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
      .refine((v) => v.length % 4 === 0),
  })
  .strict();
export type EncryptedPortal = z.infer<typeof encryptedPortal>;
export const portalDetails = z
  .object({
    name: z.string().trim().min(1, "Enter an account name.").max(160),
    url: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (v) => Boolean(safeJobUrl(v)),
        "Enter a complete http:// or https:// portal URL without login credentials.",
      )
      .transform((v) => safeJobUrl(v)!)
      .pipe(z.string().max(2048, "Use a shorter portal URL.")),
    username: z.string().max(320),
    password: z.string().max(1024),
    notes: z.string().max(5000),
  })
  .strict();
export type PortalDetails = z.infer<typeof portalDetails>;
export const emptyPortal: PortalDetails = {
  name: "",
  url: "",
  username: "",
  password: "",
  notes: "",
};
export const passphraseInput = z
  .string()
  .min(12, "Use at least 12 characters for your vault passphrase.")
  .max(256, "Use at most 256 characters.");
export type VaultRecord = VaultEnvelope & {
  id: string;
  user_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type PortalRecord = EncryptedPortal & {
  id: string;
  user_id: string;
  vault_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type PortalLink = {
  application_id: string;
  portal_id: string;
  vault_id: string;
  user_id: string;
  created_at: string;
};
export type VaultResult<T = undefined> =
  { ok: true; data: T } | { ok: false; message: string; lock?: boolean };

export function envelopeOnly(record: VaultRecord): VaultEnvelope {
  return vaultEnvelope.parse(
    Object.fromEntries(
      Object.keys(vaultEnvelope.shape).map((key) => [
        key,
        record[key as keyof VaultEnvelope],
      ]),
    ),
  );
}
export function portalEnvelopeOnly(record: PortalRecord): EncryptedPortal {
  return encryptedPortal.parse({
    version: record.version,
    nonce: record.nonce,
    ciphertext: record.ciphertext,
  });
}

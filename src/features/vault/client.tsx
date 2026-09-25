"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AlertDialog } from "radix-ui";
import { LockKeyhole, ShieldCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkVault,
  saveVaultAccess,
  loadPortalPage,
  savePortal,
  linkPortal,
  deletePortal,
  resetVault,
} from "./actions";
import {
  createVaultKeys,
  unlockVault,
  replaceVaultAccess,
  encryptPortal,
  decryptPortal,
} from "./crypto";
import { browserDeriver } from "./derive";
import {
  envelopeOnly,
  portalEnvelopeOnly,
  emptyPortal,
  VAULT_PAGE_SIZE,
  type VaultRecord,
  type VaultResult,
  type PortalDetails,
} from "./model";
import {
  IDLE_MS,
  LOCK_EVENT,
  LOCK_CHANNEL,
  broadcastVaultLock,
  lockSource,
} from "./lock";
import { AccessForm, RecoveryConfirmation, PortalForm } from "./forms";
import { PortalCard, type OpenPortal } from "./card";
const subscribe = () => () => {};
type AccessMode = "setup" | "unlock" | "recovery" | "change";
type PendingAccess = Awaited<ReturnType<typeof createVaultKeys>> & {
  id: string;
  revision: number | null;
};

export function VaultClient({
  owner,
  initial,
  application,
}: {
  owner: string;
  initial: VaultRecord | null;
  application: { id: string; company: string; role: string } | null;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [settings, setSettings] = useState(initial);
  const settingsRef = useRef(initial);
  const key = useRef<CryptoKey | null>(null);
  const abort = useRef(new AbortController());
  const generation = useRef(0);
  const lastActivity = useRef(0);
  const busyRef = useRef(false);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<AccessMode>(initial ? "unlock" : "setup");
  const [pendingAccess, setPendingAccess] = useState<PendingAccess | null>(
    null,
  );
  const [entries, setEntries] = useState<OpenPortal[]>([]);
  const [linked, setLinked] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [onlyLinked, setOnlyLinked] = useState(Boolean(application));
  const [draft, setDraft] = useState<{
    id: string;
    revision: number | null;
    details: PortalDetails;
  } | null>(null);
  const [deleting, setDeleting] = useState<OpenPortal | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const storeSettings = (value: VaultRecord | null) => {
    settingsRef.current = value;
    setSettings(value);
  };
  const lock = useCallback(
    (reason = "Vault locked. Unsaved credentials have been cleared.") => {
      generation.current += 1;
      abort.current.abort();
      abort.current = new AbortController();
      key.current = null;
      busyRef.current = false;
      lastActivity.current = Date.now();
      setEpoch(generation.current);
      setBusy(false);
      setUnlocked(false);
      setEntries([]);
      setDraft(null);
      setPendingAccess(null);
      setDeleting(null);
      setResetting(false);
      setConfirmation("");
      setMode(settingsRef.current ? "unlock" : "setup");
      setMessage(reason);
    },
    [],
  );
  const accept = <T,>(result: VaultResult<T>): T => {
    if (!result.ok) {
      if (result.lock) lock(result.message);
      throw new Error(result.message);
    }
    return result.data;
  };
  const fresh = async () => {
    if (
      document.visibilityState === "hidden" ||
      Date.now() - lastActivity.current >= IDLE_MS
    ) {
      lock();
      throw new Error("Vault locked.");
    }
    let current: VaultResult<VaultRecord | null>;
    try {
      current = await checkVault(owner);
    } catch {
      lock(
        "Your session could not be checked. Unlock again when your connection returns.",
      );
      throw new Error("Vault locked.");
    }
    const value = accept(current);
    if (
      value?.id !== settingsRef.current?.id ||
      value?.revision !== settingsRef.current?.revision
    ) {
      storeSettings(value);
      lock("Vault access changed. Unlock with the current passphrase.");
      throw new Error("Vault changed.");
    }
    return value;
  };
  const run = async (operation: (stamp: number) => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    const stamp = generation.current;
    try {
      await operation(stamp);
    } catch (error) {
      if (stamp === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "The operation could not be completed. Please try again.",
        );
    } finally {
      if (stamp === generation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  const same = (stamp: number) =>
    stamp === generation.current && document.visibilityState !== "hidden";
  const showPage = async (
    activeKey: CryptoKey,
    vaultId: string,
    nextPage: number,
    linkedOnly: boolean,
    stamp: number,
  ) => {
    const result = accept(
      await loadPortalPage(
        owner,
        vaultId,
        application?.id ?? null,
        linkedOnly,
        nextPage,
      ),
    );
    if (!same(stamp)) return;
    const opened = await Promise.all(
      result.records.map(async (record) => {
        try {
          return {
            record,
            details: await decryptPortal(
              activeKey,
              portalEnvelopeOnly(record),
              owner,
              vaultId,
              record.id,
            ),
          };
        } catch {
          return { record, details: null };
        }
      }),
    );
    if (!same(stamp)) return;
    setEntries(opened);
    setLinked(result.linked);
    setCount(result.count);
    setPage(nextPage);
    setOnlyLinked(linkedOnly);
  };
  const reload = (nextPage = page, linkedOnly = onlyLinked) =>
    run(async (stamp) => {
      const current = await fresh();
      const activeKey = key.current;
      if (!current || !activeKey || !same(stamp)) return;
      await showPage(activeKey, current.id, nextPage, linkedOnly, stamp);
    });

  // Clear state before a route is hidden, including React Activity preservation.
  // Dropping only the key ref would leave decrypted forms in retained React state.
  useLayoutEffect(() => () => lock(), [lock]);

  useEffect(() => {
    lastActivity.current = Date.now();
    const hidden = () => {
      if (document.visibilityState === "hidden") lock();
    };
    const onLock = () => lock();
    const activity = () => {
      lastActivity.current = Date.now();
    };
    const idle = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_MS)
        lock(
          "Vault locked after 5 minutes of inactivity. Unsaved credentials have been cleared.",
        );
    }, 1000);
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(LOCK_CHANNEL);
    if (channel)
      channel.onmessage = (event) => {
        if (event.data?.type === "lock" && event.data.source !== lockSource())
          lock();
      };
    let stopped = false;
    let checking = false;
    const verify = async () => {
      if (checking || busyRef.current || document.visibilityState === "hidden")
        return;
      checking = true;
      const stamp = generation.current;
      const expected = settingsRef.current;
      try {
        const result = await checkVault(owner);
        if (
          stopped ||
          busyRef.current ||
          expected !== settingsRef.current ||
          stamp !== generation.current
        )
          return;
        if (!result.ok) lock(result.message);
        else if (
          result.data?.id !== settingsRef.current?.id ||
          result.data?.revision !== settingsRef.current?.revision
        ) {
          settingsRef.current = result.data;
          setSettings(result.data);
          lock("Vault access changed. Unlock with the current passphrase.");
        }
      } catch {
        if (!stopped && stamp === generation.current)
          lock(
            "Your session could not be checked. Unlock again when your connection returns.",
          );
      } finally {
        checking = false;
      }
    };
    const poll = setInterval(verify, 15000);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", onLock);
    window.addEventListener("pageshow", onLock);
    window.addEventListener("focus", verify);
    window.addEventListener(LOCK_EVENT, onLock);
    for (const event of ["pointerdown", "keydown", "wheel"] as const)
      window.addEventListener(event, activity, { passive: true });
    return () => {
      stopped = true;
      clearInterval(idle);
      clearInterval(poll);
      channel?.close();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", onLock);
      window.removeEventListener("pageshow", onLock);
      window.removeEventListener("focus", verify);
      window.removeEventListener(LOCK_EVENT, onLock);
      for (const event of ["pointerdown", "keydown", "wheel"] as const)
        window.removeEventListener(event, activity);
    };
  }, [lock, owner]);

  async function access(secret: string, next: string) {
    await run(async (stamp) => {
      const current = await fresh();
      if (!same(stamp)) return;
      const derive = browserDeriver(abort.current.signal);
      try {
        if (mode === "unlock" && current) {
          const unlockedKey = await unlockVault(
            envelopeOnly(current),
            secret,
            owner,
            current.id,
            derive,
          );
          if (!same(stamp)) return;
          // Recheck after a potentially slow KDF before making plaintext visible.
          await fresh();
          if (!same(stamp)) return;
          await showPage(unlockedKey, current.id, 1, onlyLinked, stamp);
          if (!same(stamp)) return;
          key.current = unlockedKey;
          setUnlocked(true);
          setEpoch((value) => value + 1);
        } else {
          const id = current?.id ?? crypto.randomUUID();
          const bundle = current
            ? await replaceVaultAccess(
                envelopeOnly(current),
                secret,
                mode === "recovery" ? "recovery" : "passphrase",
                next,
                owner,
                id,
                derive,
              )
            : await createVaultKeys(next, owner, id, derive);
          if (!same(stamp)) return;
          setPendingAccess({
            ...bundle,
            id,
            revision: current?.revision ?? null,
          });
        }
      } catch {
        if (same(stamp))
          throw new Error(
            mode === "setup"
              ? "The vault could not be prepared. This browser needs Web Crypto and WebAssembly; try again."
              : "Could not unlock the vault. Check the passphrase or recovery key and try again.",
          );
      }
    });
  }
  const finishAccess = () =>
    run(async (stamp) => {
      if (!pendingAccess) return;
      await fresh();
      if (!same(stamp)) return;
      const saved = accept(
        await saveVaultAccess(
          owner,
          pendingAccess.id,
          pendingAccess.revision,
          pendingAccess.envelope,
        ),
      );
      if (!same(stamp)) return;
      storeSettings(saved);
      setPendingAccess(null);
      broadcastVaultLock();
      setMessage(
        "Vault access saved. Unlock with your new passphrase to continue.",
      );
    });
  const persistPortal = (details: PortalDetails) =>
    run(async (stamp) => {
      const current = await fresh();
      const activeKey = key.current;
      if (!current || !activeKey || !draft || !same(stamp)) return;
      const ciphertext = await encryptPortal(
        activeKey,
        details,
        owner,
        current.id,
        draft.id,
      );
      if (!same(stamp)) return;
      accept(
        await savePortal(
          owner,
          current.id,
          draft.id,
          draft.revision,
          ciphertext,
          application?.id ?? null,
        ),
      );
      if (!same(stamp)) return;
      setDraft(null);
      await showPage(activeKey, current.id, 1, onlyLinked, stamp);
      if (same(stamp)) setMessage("Portal account saved with encryption.");
    });
  const permitReveal = async () => {
    let permitted = false;
    await run(async (stamp) => {
      await fresh();
      permitted = Boolean(key.current) && same(stamp);
    });
    return permitted;
  };
  const copy = async (value: string) => {
    await run(async (stamp) => {
      await fresh();
      if (!key.current || !same(stamp)) return;
      try {
        await navigator.clipboard.writeText(value);
        if (same(stamp))
          setMessage(
            "Copied. Your system clipboard is separate from the vault; clear it when finished.",
          );
      } catch {
        throw new Error(
          "Clipboard access is unavailable. You can reveal the value and copy it manually.",
        );
      }
    });
  };

  if (!hydrated)
    return (
      <p className="account-notice">
        Loading the secure vault interface… JavaScript is required to encrypt
        credentials on this device.
      </p>
    );
  if (
    !globalThis.isSecureContext ||
    !globalThis.crypto?.subtle ||
    typeof Worker === "undefined"
  )
    return (
      <p role="alert" className="account-notice">
        The vault needs HTTPS, Web Crypto and Web Workers. Use a supported
        browser over HTTPS (localhost is supported for development).
      </p>
    );
  return (
    <div className="vault-workspace">
      <div className="vault-state-bar">
        <span>
          {unlocked ? (
            <ShieldCheck size={18} aria-hidden="true" />
          ) : (
            <LockKeyhole size={18} aria-hidden="true" />
          )}
          {unlocked ? "Vault unlocked on this page" : "Vault locked"}
        </span>
        <Button type="button" variant="outline" onClick={broadcastVaultLock}>
          Lock vault
        </Button>
      </div>
      <p className="journey-help">
        Locks when you leave this page, hide the tab, sign out, or after 5
        minutes without activity. Locking clears unsaved credentials. Revealed
        passwords hide after 15 seconds.
      </p>
      {message && (
        <p role="status" className="account-notice vault-message">
          {message}
        </p>
      )}
      {pendingAccess ? (
        <RecoveryConfirmation
          code={pendingAccess.recoveryCode}
          busy={busy}
          onConfirm={finishAccess}
          onCancel={() => lock("Vault access was not changed.")}
        />
      ) : !unlocked || mode === "change" ? (
        <section className="vault-access-panel">
          <p className="eyebrow">YOUR PRIVATE CREDENTIALS</p>
          <h2>
            {mode === "setup"
              ? "Create your vault."
              : mode === "recovery"
                ? "Recover your vault."
                : mode === "change"
                  ? "Change your vault passphrase."
                  : "Unlock your portal accounts."}
          </h2>
          <p>
            {mode === "setup"
              ? "Portal names, links, usernames, passwords and notes are encrypted on this device. Your passphrase and recovery key never leave the browser."
              : mode === "recovery" || mode === "change"
                ? "This creates a new recovery key and replaces the saved unlock information. Existing portal accounts stay encrypted with the same data key."
                : "Use your vault passphrase to decrypt your saved accounts on this device."}
          </p>
          <AccessForm
            key={`${mode}:${epoch}`}
            mode={mode}
            busy={busy}
            onSubmit={access}
            onCancel={
              mode === "change" || mode === "recovery"
                ? () => lock()
                : undefined
            }
          />
          {settings && mode === "unlock" && (
            <button
              type="button"
              className="journey-text-button mt-6"
              disabled={busy}
              onClick={() => {
                setMode("recovery");
                setMessage("");
              }}
            >
              Use a recovery key
            </button>
          )}
        </section>
      ) : draft ? (
        <PortalForm
          key={`${draft.id}:${epoch}`}
          initial={draft.details}
          editing={draft.revision !== null}
          busy={busy}
          onSave={persistPortal}
          onCancel={() => setDraft(null)}
        />
      ) : (
        <>
          <div className="vault-toolbar">
            <div>
              <h2>
                {application && onlyLinked
                  ? "Linked portal accounts"
                  : "All portal accounts"}
              </h2>
              <p className="journey-help">
                {count} saved {count === 1 ? "account" : "accounts"}
                {application && onlyLinked ? ` for ${application.company}` : ""}
              </p>
            </div>
            <div className="vault-buttons">
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraft({
                    id: crypto.randomUUID(),
                    revision: null,
                    details: emptyPortal,
                  });
                  setMessage("");
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Add portal account
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setMode("change");
                  setMessage("");
                }}
              >
                Change passphrase
              </Button>
            </div>
          </div>
          {application && (
            <div className="vault-buttons mb-5">
              <Button
                type="button"
                variant={onlyLinked ? "default" : "outline"}
                disabled={busy}
                onClick={() => reload(1, true)}
              >
                Linked accounts
              </Button>
              <Button
                type="button"
                variant={!onlyLinked ? "default" : "outline"}
                disabled={busy}
                onClick={() => reload(1, false)}
              >
                Link an existing account
              </Button>
            </div>
          )}
          {!entries.length && (
            <p className="journey-empty">
              No portal accounts on this page.{" "}
              {application && onlyLinked
                ? "Add one or link an existing account to this application."
                : "Add your first portal account to keep its login details together."}
            </p>
          )}
          <ul className="vault-accounts" aria-label="Saved portal accounts">
            {entries.map((entry) => (
              <PortalCard
                key={`${entry.record.id}:${entry.record.revision}:${epoch}`}
                entry={entry}
                linked={linked.includes(entry.record.id)}
                linking={Boolean(application)}
                busy={busy}
                onCopy={copy}
                onReveal={permitReveal}
                onEdit={() => {
                  if (entry.details) {
                    setDraft({
                      id: entry.record.id,
                      revision: entry.record.revision,
                      details: entry.details,
                    });
                    setMessage("");
                  }
                }}
                onDelete={() => setDeleting(entry)}
                onLink={() =>
                  run(async (stamp) => {
                    const current = await fresh();
                    const activeKey = key.current;
                    if (!current || !activeKey || !application || !same(stamp))
                      return;
                    accept(
                      await linkPortal(
                        owner,
                        current.id,
                        entry.record.id,
                        application.id,
                        !linked.includes(entry.record.id),
                      ),
                    );
                    if (same(stamp))
                      await showPage(
                        activeKey,
                        current.id,
                        page,
                        onlyLinked,
                        stamp,
                      );
                  })
                }
              />
            ))}
          </ul>
          <nav className="journey-pagination" aria-label="Portal account pages">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || busy}
              onClick={() => reload(page - 1)}
            >
              Previous page
            </Button>
            <span>
              Page {page} of {Math.max(1, Math.ceil(count / VAULT_PAGE_SIZE))}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page * VAULT_PAGE_SIZE >= count || busy}
              onClick={() => reload(page + 1)}
            >
              Next page
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => reload(1)}
            >
              Reload accounts
            </Button>
          </nav>
        </>
      )}
      {application && (
        <p className="mt-6">
          <Link
            className="journey-text-button"
            href={`/app/applications/${application.id}`}
          >
            Back to {application.company} application
          </Link>
        </p>
      )}
      {settings && (
        <div className="tracking-delete">
          <p>
            Lost both ways to unlock? Resetting permanently deletes all saved
            portal accounts and their application links.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy || Boolean(pendingAccess)}
            onClick={() => {
              setResetting(true);
              setConfirmation("");
            }}
          >
            Reset vault
          </Button>
        </div>
      )}
      <AlertDialog.Root
        open={Boolean(deleting) || resetting}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleting(null);
            setResetting(false);
            setConfirmation("");
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="dialog-content">
            <AlertDialog.Title className="text-2xl font-semibold">
              {resetting
                ? "Reset the entire vault?"
                : "Delete this portal account?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {resetting
                ? "All encrypted portal accounts and their application links will be permanently deleted. Your job applications stay intact. Type DELETE VAULT to confirm."
                : "This account and its links to every application will be permanently deleted. This can’t be undone."}
            </AlertDialog.Description>
            {resetting && (
              <div className="field-label mt-4">
                <label htmlFor="reset-vault-confirm">Type DELETE VAULT</label>
                <input
                  id="reset-vault-confirm"
                  className="field"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
            )}
            {message && (
              <p role="alert" className="tracking-field-error mt-4">
                {message}
              </p>
            )}
            <div className="vault-buttons mt-6">
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  Keep {resetting ? "vault" : "account"}
                </Button>
              </AlertDialog.Cancel>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  busy || (resetting && confirmation !== "DELETE VAULT")
                }
                onClick={() =>
                  run(async (stamp) => {
                    const current = await fresh();
                    if (!current || !same(stamp)) return;
                    if (resetting) {
                      accept(
                        await resetVault(
                          owner,
                          current.id,
                          current.revision,
                          confirmation,
                        ),
                      );
                      if (!same(stamp)) return;
                      storeSettings(null);
                      broadcastVaultLock();
                      setMessage(
                        "Vault reset. Your applications are unchanged.",
                      );
                    } else if (deleting && key.current) {
                      const activeKey = key.current;
                      accept(
                        await deletePortal(
                          owner,
                          current.id,
                          deleting.record.id,
                          deleting.record.revision,
                          "delete",
                        ),
                      );
                      if (!same(stamp)) return;
                      setDeleting(null);
                      await showPage(
                        activeKey,
                        current.id,
                        1,
                        onlyLinked,
                        stamp,
                      );
                      setMessage("Portal account deleted.");
                    }
                  })
                }
              >
                {busy
                  ? "Deleting…"
                  : resetting
                    ? "Delete vault permanently"
                    : "Delete account permanently"}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

import { randomUUID } from "node:crypto";
import { argon2id } from "hash-wasm";
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { signIn, seed } from "../helpers/tracking";
import { unlockVault, encryptPortal } from "../../src/features/vault/crypto";
import {
  envelopeOnly,
  type VaultRecord,
  type PortalRecord,
} from "../../src/features/vault/model";

test.use({ baseURL: "http://127.0.0.1:3102" });
const pass = "Fictional-vault-passphrase-431!";
const details = {
  name: "Private employer portal marker",
  url: "https://example.com/private-careers-marker",
  username: "fictional-vault-user@example.com",
  password: "FAKE-portal-password-marker!",
  notes: "Private encrypted notes marker",
};
async function confirmRecovery(page: Page) {
  const code = await page
    .getByLabel("Your new recovery key", { exact: true })
    .inputValue();
  expect(code).toMatch(/^RZ1-[\w-]{43}$/);
  await expect(
    page.getByRole("button", { name: "Finish saving vault access" }),
  ).toBeDisabled();
  await page
    .getByLabel("I have saved this recovery key somewhere safe.")
    .check();
  await page
    .getByRole("button", { name: "Finish saving vault access" })
    .click();
  await expect(
    page.getByText(
      "Vault access saved. Unlock with your new passphrase to continue.",
      { exact: true },
    ),
  ).toBeVisible();
  return code;
}
async function setup(page: Page, path = "/app/portals") {
  await page.goto(path);
  await page.getByLabel("New vault passphrase", { exact: true }).fill(pass);
  await page.getByLabel("Confirm new passphrase", { exact: true }).fill(pass);
  await page
    .getByRole("button", { name: "Create recovery key", exact: true })
    .click();
  return confirmRecovery(page);
}
async function unlock(page: Page, phrase = pass) {
  await page.getByLabel("Vault passphrase", { exact: true }).fill(phrase);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(
    page.getByText("Vault unlocked on this page", { exact: true }),
  ).toBeVisible();
}
async function addPortal(page: Page) {
  await page
    .getByRole("button", { name: "Add portal account", exact: true })
    .click();
  await page
    .getByLabel("Portal account name", { exact: true })
    .fill(details.name);
  await page.getByLabel("Portal URL", { exact: true }).fill(details.url);
  await page
    .getByLabel("Portal username or email", { exact: true })
    .fill(details.username);
  await page
    .getByLabel("Portal password", { exact: true })
    .fill(details.password);
  await page
    .getByLabel("Private portal notes", { exact: true })
    .fill(details.notes);
  await page
    .getByRole("button", { name: "Save portal account", exact: true })
    .click();
  await expect(
    page.getByText("Portal account saved with encryption.", { exact: true }),
  ).toBeVisible();
}
async function state(
  request: APIRequestContext,
  token: string,
): Promise<{
  credential_vaults: VaultRecord[];
  portal_accounts: PortalRecord[];
  application_portals: { application_id: string; portal_id: string }[];
}> {
  const response = await request.get(
    "http://127.0.0.1:54329/fixture/vault-state",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.ok()).toBe(true);
  return response.json();
}
async function patchPortal(
  request: APIRequestContext,
  token: string,
  record: PortalRecord,
  body: object,
) {
  const response = await request.patch(
    `http://127.0.0.1:54329/rest/v1/portal_accounts?user_id=eq.${record.user_id}&id=eq.${record.id}&revision=eq.${record.revision}`,
    { headers: { Authorization: `Bearer ${token}` }, data: body },
  );
  expect(response.ok()).toBe(true);
}

test("setup, encrypted persistence, reveal and copy never send plaintext to the server", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  const session = await signIn(context, request);
  const sent: string[] = [];
  page.on("request", (req) =>
    sent.push(`${req.url()} ${req.postData() ?? ""}`),
  );
  // Fake clipboard is confined to this test browser, avoiding host clipboard writes.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copied = text;
        },
      },
    });
  });
  const recovery = await setup(page);
  await page
    .getByLabel("Vault passphrase", { exact: true })
    .fill("Incorrect-passphrase-123");
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(page.getByText(/Could not unlock the vault/)).toBeVisible();
  await unlock(page);
  await addPortal(page);
  await expect(page.getByText(details.password, { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Open portal" })).toHaveAttribute(
    "href",
    details.url,
  );
  await page
    .getByRole("button", { name: "Reveal password", exact: true })
    .click();
  await expect(page.getByText(details.password, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Copy password", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-copied",
    details.password,
  );
  const stored = await state(request, session.access_token);
  expect(stored.portal_accounts).toHaveLength(1);
  for (const secret of [pass, recovery, ...Object.values(details)]) {
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(sent.join("\n")).not.toContain(secret);
  }
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unlock vault", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(details.name, { exact: true })).toHaveCount(0);
  await unlock(page);
  await expect(
    page.getByRole("heading", { name: details.name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit account", exact: true }).click();
  await page
    .getByLabel("Private portal notes", { exact: true })
    .fill("Updated encrypted context");
  await page
    .getByRole("button", { name: "Save portal account", exact: true })
    .click();
  await expect(
    page.getByText("Portal account saved with encryption.", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Saved portal accounts", exact: true })
      .getByText("Updated encrypted context", { exact: true }),
  ).toBeVisible();
  const updated = await state(request, session.access_token);
  expect(updated.portal_accounts[0].revision).toBe(2);
  expect(updated.portal_accounts[0].nonce).not.toBe(
    stored.portal_accounts[0].nonce,
  );
});

test("recovery and passphrase changes preserve accounts and rotate current unlock information", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  const session = await signIn(context, request);
  const oldRecovery = await setup(page);
  await unlock(page);
  await addPortal(page);
  const before = await state(request, session.access_token);
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await page
    .getByRole("button", { name: "Use a recovery key", exact: true })
    .click();
  const recoveredPass = "Recovered-fictional-passphrase-123!";
  await page.getByLabel("Recovery key", { exact: true }).fill(oldRecovery);
  await page
    .getByLabel("New vault passphrase", { exact: true })
    .fill(recoveredPass);
  await page
    .getByLabel("Confirm new passphrase", { exact: true })
    .fill(recoveredPass);
  await page
    .getByRole("button", { name: "Prepare new vault access", exact: true })
    .click();
  const newRecovery = await confirmRecovery(page);
  expect(newRecovery).not.toBe(oldRecovery);
  await page.getByLabel("Vault passphrase", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(page.getByText(/Could not unlock the vault/)).toBeVisible();
  await unlock(page, recoveredPass);
  await expect(page.getByRole("heading", { name: details.name })).toBeVisible();
  await page
    .getByRole("button", { name: "Change passphrase", exact: true })
    .click();
  const changedPass = "Changed-fictional-passphrase-456!";
  await page
    .getByLabel("Current vault passphrase", { exact: true })
    .fill(recoveredPass);
  await page
    .getByLabel("New vault passphrase", { exact: true })
    .fill(changedPass);
  await page
    .getByLabel("Confirm new passphrase", { exact: true })
    .fill(changedPass);
  await page
    .getByRole("button", { name: "Prepare new vault access", exact: true })
    .click();
  await confirmRecovery(page);
  await unlock(page, changedPass);
  await expect(page.getByRole("heading", { name: details.name })).toBeVisible();
  const after = await state(request, session.access_token);
  expect(after.credential_vaults[0].revision).toBe(3);
  expect(after.portal_accounts).toEqual(before.portal_accounts);
});

test("one portal links to several applications and survives application deletion", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  const session = await signIn(context, request);
  const a = randomUUID(),
    b = randomUUID();
  await seed(request, session.access_token, [
    { id: a, company: "Shared employer A" },
    { id: b, company: "Shared employer B" },
  ]);
  await setup(page, `/app/portals?application=${a}`);
  await unlock(page);
  await addPortal(page);
  await page.goto(`/app/applications/${a}`);
  await expect(page.getByText(/1 linked portal account/)).toBeVisible();
  await page.goto(`/app/portals?application=${b}`);
  await unlock(page);
  await expect(page.getByRole("heading", { name: details.name })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Link an existing account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Link to application", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unlink application", exact: true }),
  ).toBeVisible();
  expect(
    (await state(request, session.access_token)).application_portals,
  ).toHaveLength(2);
  await page
    .getByRole("button", { name: "Unlink application", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Link to application", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Link to application", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unlink application", exact: true }),
  ).toBeVisible();
  await page.goto(`/app/applications/${a}`);
  await page
    .getByRole("button", { name: "Delete application", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/applications\?deleted=1$/);
  const remaining = await state(request, session.access_token);
  expect(remaining.portal_accounts).toHaveLength(1);
  expect(remaining.application_portals).toHaveLength(1);
  expect(remaining.application_portals[0].application_id).toBe(b);
  await page.goto(`/app/portals?application=${b}`);
  await unlock(page);
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep account", exact: true }).click();
  await expect(page.getByRole("heading", { name: details.name })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete account permanently", exact: true })
    .click();
  await expect(
    page.getByText("Portal account deleted.", { exact: true }),
  ).toBeVisible();
  expect(
    (await state(request, session.access_token)).application_portals,
  ).toHaveLength(0);
});

test("password reveal expires, idle and hidden pages lock, and navigation clears drafts", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  await signIn(context, request);
  await setup(page);
  await unlock(page);
  await addPortal(page);
  await page.clock.install();
  await page
    .getByRole("button", { name: "Reveal password", exact: true })
    .click();
  await expect(page.getByText(details.password, { exact: true })).toBeVisible();
  await page.clock.fastForward(16000);
  await expect(
    page.getByRole("button", { name: "Reveal password", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(5 * 60 * 1000);
  await expect(page.getByText(/Vault locked after 5 minutes/)).toBeVisible();
  await expect(page.getByText(details.username, { exact: true })).toHaveCount(
    0,
  );
  await unlock(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Unlock vault", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await unlock(page);
  await page.getByRole("button", { name: "Edit account", exact: true }).click();
  await page
    .getByLabel("Portal password", { exact: true })
    .fill("Unsaved-secret-marker");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "A little closer to what’s next.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Portals & vault", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unlock vault", exact: true }),
  ).toBeVisible();
  await unlock(page);
  await page.getByRole("button", { name: "Edit account", exact: true }).click();
  await expect(page.getByLabel("Portal password", { exact: true })).toHaveValue(
    details.password,
  );
});

test("invalid links and failed writes retain drafts until locking clears them", async ({
  page,
  context,
  request,
}) => {
  const session = await signIn(context, request);
  await setup(page);
  await unlock(page);
  await page
    .getByRole("button", { name: "Add portal account", exact: true })
    .click();
  await page
    .getByLabel("Portal account name", { exact: true })
    .fill(details.name);
  await page
    .getByLabel("Portal URL", { exact: true })
    .fill("https://user:password@example.com");
  await page
    .getByLabel("Portal password", { exact: true })
    .fill(details.password);
  await page
    .getByRole("button", { name: "Save portal account", exact: true })
    .click();
  await expect(page.getByText(/Enter a complete http/)).toBeVisible();
  await page.getByLabel("Portal URL", { exact: true }).fill(details.url);
  await signIn(context, request, session.user.id, "&writeError=1");
  await page
    .getByRole("button", { name: "Save portal account", exact: true })
    .click();
  await expect(page.getByText(/This change could not be saved/)).toBeVisible();
  await expect(page.getByLabel("Portal password", { exact: true })).toHaveValue(
    details.password,
  );
  expect(
    (await state(request, session.access_token)).portal_accounts,
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await signIn(context, request, session.user.id);
  await unlock(page);
  await page
    .getByRole("button", { name: "Add portal account", exact: true })
    .click();
  await expect(page.getByLabel("Portal password", { exact: true })).toHaveValue(
    "",
  );
});

test("stale edits and deletes fail, while account changes lock before reveal", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  const session = await signIn(context, request);
  await setup(page);
  await unlock(page);
  await addPortal(page);
  let record = (await state(request, session.access_token)).portal_accounts[0];
  await page.getByRole("button", { name: "Edit account", exact: true }).click();
  await patchPortal(request, session.access_token, record, {
    ciphertext: record.ciphertext,
  });
  await page
    .getByLabel("Private portal notes", { exact: true })
    .fill("Stale draft");
  await page
    .getByRole("button", { name: "Save portal account", exact: true })
    .click();
  await expect(
    page.getByText(/This record changed or was removed/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Reload accounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  record = (await state(request, session.access_token)).portal_accounts[0];
  await patchPortal(request, session.access_token, record, {
    ciphertext: record.ciphertext,
  });
  await page
    .getByRole("button", { name: "Delete account permanently", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "This record changed or was removed",
  );
  await page.getByRole("button", { name: "Keep account", exact: true }).click();
  await signIn(context, request);
  await page
    .getByRole("button", { name: "Reveal password", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unlock vault", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(details.username, { exact: true })).toHaveCount(
    0,
  );
  expect(
    (await state(request, session.access_token)).portal_accounts,
  ).toHaveLength(1);
});

test("encrypted pagination isolates damaged records and reset keeps applications", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  const session = await signIn(context, request);
  const app = randomUUID();
  await seed(request, session.access_token, [
    { id: app, company: "Keep application" },
  ]);
  await setup(page);
  const vault = (await state(request, session.access_token))
    .credential_vaults[0];
  const key = await unlockVault(
    envelopeOnly(vault),
    pass,
    session.user.id,
    vault.id,
    (password, salt) =>
      argon2id({
        password,
        salt,
        memorySize: 65536,
        iterations: 3,
        parallelism: 4,
        hashLength: 32,
        outputType: "binary",
      }),
  );
  for (let index = 0; index < 23; index++) {
    const id = randomUUID();
    const encrypted = await encryptPortal(
      key,
      { ...details, name: `Account ${index}` },
      session.user.id,
      vault.id,
      id,
    );
    const response = await request.post(
      "http://127.0.0.1:54329/rest/v1/rpc/create_portal_account",
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
        data: {
          p_id: id,
          p_vault_id: vault.id,
          p_nonce: encrypted.nonce,
          p_ciphertext: encrypted.ciphertext,
          p_application_id: app,
        },
      },
    );
    expect(response.ok()).toBe(true);
  }
  const broken = (await state(request, session.access_token))
    .portal_accounts[0];
  await patchPortal(request, session.access_token, broken, {
    ciphertext: Buffer.alloc(48).toString("base64"),
  });
  await unlock(page);
  const accounts = page.getByRole("list", {
    name: "Saved portal accounts",
    exact: true,
  });
  await expect(accounts.getByRole("listitem")).toHaveCount(20);
  await expect(
    page.getByRole("heading", {
      name: "Account could not be decrypted",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(accounts.getByRole("listitem")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(accounts.getByRole("listitem")).toHaveCount(20);
  await page.getByRole("button", { name: "Reset vault", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete vault permanently", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Type DELETE VAULT", { exact: true })
    .fill("DELETE VAULT");
  await page
    .getByRole("button", { name: "Delete vault permanently", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your vault.", exact: true }),
  ).toBeVisible();
  expect(await state(request, session.access_token)).toEqual({
    credential_vaults: [],
    portal_accounts: [],
    application_portals: [],
  });
  await page.goto(`/app/applications/${app}`);
  await expect(
    page.getByText("Keep application", { exact: true }),
  ).toBeVisible();
});

test("cancelled setup saves nothing and cross-tab sign-out clears the vault", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  const session = await signIn(context, request);
  await page.goto("/app/portals");
  await page.getByLabel("New vault passphrase", { exact: true }).fill(pass);
  await page.getByLabel("Confirm new passphrase", { exact: true }).fill(pass);
  await page
    .getByRole("button", { name: "Create recovery key", exact: true })
    .click();
  await expect(
    page.getByLabel("Your new recovery key", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await state(request, session.access_token)).credential_vaults,
  ).toHaveLength(0);
  await setup(page);
  await unlock(page);
  await addPortal(page);
  const other = await context.newPage();
  await other.goto("/app");
  await other.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByText(details.username, { exact: true })).toHaveCount(
    0,
  );
  await expect(other).toHaveURL(/\/login/);
  await other.close();
});

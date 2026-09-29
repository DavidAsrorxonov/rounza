import {
  test,
  expect,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

const fixture = "http://127.0.0.1:54329";
test.use({ baseURL: "http://127.0.0.1:3102" });
async function seed(
  context: BrowserContext,
  request: APIRequestContext,
  user = "fresh",
) {
  const session = await (
    await request.get(`${fixture}/fixture/session?user=${user}`)
  ).json();
  await cookie(context, session);
  return session;
}
async function cookie(context: BrowserContext, session: unknown) {
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
const headers = (session: { access_token: string }) => ({
  Authorization: `Bearer ${session.access_token}`,
});
async function authorization(
  request: APIRequestContext,
  session: { access_token: string },
  query = "",
) {
  const result = await (
    await request.get(`${fixture}/fixture/authorization?${query}`, {
      headers: headers(session),
    })
  ).json();
  expect(result.id).toMatch(/^[a-z2-7]{32}$/);
  return result;
}
async function tool(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
) {
  return request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
}
test("consent preserves selected records across search pages and MCP obeys permission changes and revocation", async ({
  page,
  context,
  request,
}) => {
  const session = await seed(context, request);
  const apps = Array.from({ length: 25 }, (_, i) => ({
    id: randomUUID(),
    company: `Company ${String(i).padStart(2, "0")}`,
    role: "Engineer",
  }));
  await request.post(`${fixture}/fixture/applications`, {
    headers: headers(session),
    data: apps,
  });
  const resumeId = randomUUID();
  await request.post(`${fixture}/fixture/resumes`, {
    headers: headers(session),
    data: [
      { id: resumeId, name: "Reviewed CV", body: "My reviewed career history" },
    ],
  });
  const auth = await authorization(request, session);
  await page.goto(`/auth/consent?authorization_id=${auth.id}`);
  await expect(
    page.getByRole("button", { name: "Allow read access" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Resume access", { exact: true })).toHaveValue(
    "none",
  );
  await page
    .getByRole("checkbox", { name: "Company 00 — Engineer", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Next applications", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Company 24 — Engineer", exact: true })
    .check();
  await expect(
    page.getByText("2 selected across all pages", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Resume access", { exact: true })
    .selectOption("selected");
  await page
    .getByRole("checkbox", { name: "Reviewed CV", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "I approve this assistant", exact: false })
    .check();
  await page.getByRole("button", { name: "Allow read access" }).click();
  await expect(page).toHaveURL(/fixture\/connected\?result=approve/);
  const delegated = await (
    await request.get(
      `${fixture}/fixture/delegated?client_id=${auth.clientId}`,
      { headers: headers(session) },
    )
  ).json();
  const searched = await tool(
    request,
    delegated.access_token,
    "search_applications",
  );
  expect(searched.status()).toBe(200);
  const result = (await searched.json()).result.structuredContent;
  expect(result.items.map((r: { id: string }) => r.id).sort()).toEqual(
    [apps[0].id, apps[24].id].sort(),
  );
  const resume = await tool(request, delegated.access_token, "get_resume", {
    id: resumeId,
  });
  expect((await resume.json()).result.structuredContent.resume.body).toBe(
    "My reviewed career history",
  );
  await page.goto("/app/ai-connections");
  await page.getByRole("link", { name: "Manage access", exact: true }).click();
  await page
    .getByLabel("Application access", { exact: true })
    .selectOption("none");
  await page.getByLabel("Resume access", { exact: true }).selectOption("none");
  await page.getByRole("button", { name: "Save permissions" }).click();
  await expect(page.getByRole("status")).toContainText("Permissions updated");
  expect(
    (
      await (
        await tool(request, delegated.access_token, "search_applications")
      ).json()
    ).result.structuredContent.items,
  ).toEqual([]);
  expect(
    (
      await (
        await tool(request, delegated.access_token, "get_resume", {
          id: resumeId,
        })
      ).json()
    ).result.isError,
  ).toBe(true);
  await page.getByRole("link", { name: "Manage access", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "Revoke this assistant’s access",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Revoke connection", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Connection revoked");
  expect(
    (await tool(request, delegated.access_token, "list_resumes")).status(),
  ).toBe(401);
});
test("declined and expired authorization cannot create a connection", async ({
  page,
  context,
  request,
}) => {
  const session = await seed(context, request);
  const denied = await authorization(request, session);
  await page.goto(`/auth/consent?authorization_id=${denied.id}`);
  await page.getByRole("button", { name: "Decline connection" }).click();
  await expect(page).toHaveURL(/result=deny/);
  const expired = await authorization(request, session, "expired=1");
  await page.goto(`/auth/consent?authorization_id=${expired.id}`);
  await expect(
    page.getByRole("heading", { name: "Connection unavailable" }),
  ).toBeVisible();
  await page.goto("/app/ai-connections");
  await expect(
    page.getByRole("link", { name: "Manage access", exact: true }),
  ).toHaveCount(0);
});
test("Google sign-in returns only to the pending consent request", async ({
  page,
  request,
}) => {
  const session = await (
    await request.get(`${fixture}/fixture/session?user=alice`)
  ).json();
  const auth = await authorization(request, session);
  await page.goto(`/auth/consent?authorization_id=${auth.id}`);
  await expect(page).toHaveURL(`/login?authorization_id=${auth.id}`);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(`/auth/consent?authorization_id=${auth.id}`);
  await expect(
    page.getByRole("heading", {
      name: "Allow Fixture assistant to read Rounza?",
    }),
  ).toBeVisible();
});
test("delegated tokens copied into browser cookies cannot open private pages or record selectors", async ({
  page,
  context,
  request,
}) => {
  const session = await seed(context, request);
  const delegated = await (
    await request.get(
      `${fixture}/fixture/delegated?client_id=${randomUUID()}`,
      { headers: headers(session) },
    )
  ).json();
  await context.clearCookies();
  await cookie(context, delegated);
  await page.goto("/app/ai-connections");
  await expect(page).toHaveURL("/login");
  const options = await context.request.get(
    "http://127.0.0.1:3102/app/ai-connections/options?kind=applications",
  );
  expect(options.status()).toBe(401);
});
test("stale permission forms cannot overwrite a newer grant", async ({
  page,
  context,
  request,
}) => {
  const session = await seed(context, request);
  const auth = await authorization(request, session);
  await page.goto(`/auth/consent?authorization_id=${auth.id}`);
  await page
    .getByLabel("Application access", { exact: true })
    .selectOption("all");
  await page
    .getByRole("checkbox", { name: "I approve this assistant", exact: false })
    .check();
  await page.getByRole("button", { name: "Allow read access" }).click();
  await expect(page).toHaveURL(/result=approve/);
  await page.goto("/app/ai-connections");
  await page.getByRole("link", { name: "Manage access", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/ai-connections\/[0-9a-f-]+$/);
  const other = await context.newPage();
  await other.goto(page.url());
  await other
    .getByLabel("Application access", { exact: true })
    .selectOption("none");
  await other.getByRole("button", { name: "Save permissions" }).click();
  await expect(other).toHaveURL(/updated=1/);
  await page.getByRole("button", { name: "Save permissions" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Permissions couldn’t be saved" }),
  ).toContainText("Permissions couldn’t be saved");
  await other.close();
});

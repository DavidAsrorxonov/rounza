import {
  expect,
  type BrowserContext,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
export async function signIn(
  context: BrowserContext,
  request: APIRequestContext,
  user = "fresh",
  extra = "",
) {
  const response = await request.get(
    `http://127.0.0.1:54329/fixture/session?user=${user}${extra}`,
  );
  const session = await response.json();
  await context.clearCookies();
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
  return session;
}
export async function seed(
  request: APIRequestContext,
  token: string,
  rows: Record<string, unknown>[],
) {
  const response = await request.post(
    "http://127.0.0.1:54329/fixture/applications",
    { headers: { Authorization: `Bearer ${token}` }, data: rows },
  );
  expect(response.ok()).toBe(true);
}
export async function create(page: Page, company = "Acme Studio") {
  await page.goto("/app/applications/new");
  await page.getByLabel("Company (required)").fill(company);
  await page.getByLabel("Role title (required)").fill("Product Designer");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/applications\/[a-f0-9-]+\?saved=1$/);
  return new URL(page.url()).pathname;
}

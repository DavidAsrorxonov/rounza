import {
  expect,
  test,
  type BrowserContext,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:3102" });
async function signIn(
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
async function seed(
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
async function create(page: Page, company = "Acme Studio") {
  await page.goto("/app/applications/new");
  await page.getByLabel("Company (required)").fill(company);
  await page.getByLabel("Role title (required)").fill("Product Designer");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/applications\/[a-f0-9-]+\?saved=1$/);
  return new URL(page.url()).pathname;
}

test("create, edit all details, persist across sessions, update views, and confirm deletion", async ({
  page,
  context,
  request,
}) => {
  const session = await signIn(context, request);
  await page.goto("/app/applications");
  await expect(
    page.getByRole("heading", { name: "Your next chapter starts with one." }),
  ).toBeVisible();
  const path = await create(page);
  await page
    .getByRole("link", { name: "Edit application", exact: true })
    .click();
  await page
    .getByLabel("Role title (required)")
    .fill("Senior Product Designer");
  await page.getByLabel("Location", { exact: true }).fill("Tokyo · Hybrid");
  await page
    .getByLabel("Job posting URL")
    .fill("https://example.com/jobs/designer");
  await page.getByLabel("Date applied").fill("2026-09-23");
  await page
    .getByLabel("Application status", { exact: true })
    .selectOption("Interviewing");
  await page
    .getByLabel("Job description", { exact: true })
    .fill("Build thoughtful products.\nWork with engineers.");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Ask about the design team.\nBring portfolio.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Senior Product Designer", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Ask about the design team.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open job posting" }),
  ).toHaveAttribute("href", "https://example.com/jobs/designer");
  await expect(
    page.getByText("Sep 23, 2026", { exact: true }).first(),
  ).toBeVisible();
  await signIn(context, request, session.user.id);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Senior Product Designer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "All applications", exact: true })
    .click();
  await page.getByRole("link", { name: "Board", exact: true }).click();
  const column = page.getByRole("region", {
    name: "Interviewing applications",
    exact: true,
  });
  await expect(
    column.getByRole("heading", { name: "Senior Product Designer" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(path);
  await page
    .getByRole("button", { name: "Delete application", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep application" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Delete application", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL("/app/applications?deleted=1");
  await expect(
    page.getByText("Application deleted.", { exact: true }),
  ).toBeVisible();
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Application not found." }),
  ).toBeVisible();
});

test("search, status, sorting, and pagination use all saved records and survive reload", async ({
  page,
  context,
  request,
}) => {
  const session = await signIn(context, request);
  await seed(
    request,
    session.access_token,
    Array.from({ length: 27 }, (_, i) => ({
      company: `Company ${String(i).padStart(2, "0")}`,
      role: `Designer ${i}`,
      location: i === 26 ? "Tokyo" : "London",
      status: i === 26 ? "Offer" : "Saved",
    })),
  );
  await page.goto("/app/applications?sort=company");
  await expect(
    page.getByRole("list", { name: "Application list" }).getByRole("listitem"),
  ).toHaveCount(24);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(
    page.getByRole("list", { name: "Application list" }).getByRole("listitem"),
  ).toHaveCount(3);
  await page.getByLabel("Search applications").fill("Tokyo");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "Designer 26", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Search applications")).toHaveValue("Tokyo");
  await page.getByLabel("Status", { exact: true }).selectOption("Rejected");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "No matches this time." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Search applications")).toHaveValue("");
  await page.goto("/app/applications?page=999");
  await expect(
    page.getByRole("link", { name: "Back to first page" }),
  ).toBeVisible();
});

test("invalid URLs and failed writes preserve form fields", async ({
  page,
  context,
  request,
}) => {
  await signIn(context, request, "fresh", "&writeError=1");
  await page.goto("/app/applications/new");
  await page.getByLabel("Company (required)").fill("My company");
  await page.getByLabel("Role title (required)").fill("My role");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Do not lose this note.");
  await page.getByLabel("Job posting URL").fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(
    page.getByText(
      "Enter a complete http:// or https:// URL without login credentials.",
    ),
  ).toBeVisible();
  await page.getByLabel("Job posting URL").fill("");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await expect(
    page.getByText("We couldn’t add this application.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Do not lose this note.",
  );
  await expect(page.getByLabel("Company (required)")).toHaveValue("My company");
});

test("stale edits cannot overwrite a newer save and stay available to copy", async ({
  page,
  context,
  request,
}) => {
  await signIn(context, request);
  const path = await create(page);
  await page.goto(`${path}/edit`);
  const other = await context.newPage();
  await other.goto(`${path}/edit`);
  await other
    .getByLabel("Notes", { exact: true })
    .fill("Newer notes from another tab.");
  await other.getByRole("button", { name: "Save changes" }).click();
  await expect(
    other.getByText("Newer notes from another tab.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Older draft I still need.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("This application changed or is no longer available.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Older draft I still need.",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("This application changed or is no longer available.", {
      exact: false,
    }),
  ).toBeVisible();
  await other.reload();
  await expect(
    other.getByText("Newer notes from another tab.", { exact: true }),
  ).toBeVisible();
  await other.close();
});

test("a changed login cannot use a previous account's edit form or read its details", async ({
  page,
  context,
  request,
}) => {
  const owner = await signIn(context, request);
  const path = await create(page, "Private owner company");
  await page.goto(`${path}/edit`);
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Unauthorized overwrite");
  const other = await signIn(context, request);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Application not found." }),
  ).toBeVisible();
  await page.goto("/app/applications");
  await expect(page.getByText("Private owner company")).toHaveCount(0);
  await signIn(context, request, owner.user.id);
  await page.goto(path);
  await expect(page.getByText("Unauthorized overwrite")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Delete application", exact: true })
    .click();
  await signIn(context, request, other.user.id);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await signIn(context, request, owner.user.id);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Product Designer", exact: true }),
  ).toBeVisible();
});

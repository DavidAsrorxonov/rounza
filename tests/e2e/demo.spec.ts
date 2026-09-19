import { expect, test, type Page } from "@playwright/test";

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("the demo opens, completes tasks, and keeps changes on reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Try the interactive demo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your next move",
  );
  await expectNoOverflow(page);
  await page
    .getByRole("button", {
      name: "Complete: Follow up on your application",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reopen: Follow up on your application" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reopen: Follow up on your application" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("search and status filtering work in list and board views", async ({
  page,
}) => {
  await page.goto("/demo/applications");
  const search = page.getByRole("textbox", { name: "Search applications" });
  await search.fill("no such company");
  await expect(
    page.getByRole("heading", { name: "No matches this time" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Filter by status").selectOption("Interviewing");
  await expect(
    page.getByText("3 applications · Interviewing", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Board view", exact: true }).click();
  await expect(
    page.getByRole("region", {
      name: "Interviewing applications",
      exact: true,
    }),
  ).toBeVisible();
  await search.fill("northstar");
  await expect(
    page.getByText("1 application · Interviewing matching “northstar”", {
      exact: true,
    }),
  ).toBeVisible();
  await expectNoOverflow(page);
  await page.locator('a[href="/demo/applications/northstar"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Senior Product Designer",
  );
});

test("round changes preserve history and closed applications leave upcoming views", async ({
  page,
}) => {
  await page.goto("/demo/applications/northstar");
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page.getByLabel("Date and time").fill("2030-11-12T10:15");
  await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.locator('time[datetime="2030-11-12T10:15"]')).toBeVisible();
  await expect(page.getByText(/Portfolio review: moved from/)).toBeVisible();
  await page.reload();
  await expect(page.locator('time[datetime="2030-11-12T10:15"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(
    page.getByText("3 of 5 completed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("APPLICATION STATUS", { exact: true }),
  ).toHaveValue("Interviewing");
  await page
    .getByLabel("APPLICATION STATUS", { exact: true })
    .selectOption("Offer");
  await expect(page.getByText(/This journey is closed/)).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Complete: Polish the onboarding case study",
    }),
  ).toHaveCount(0);
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.locator('a[href="/demo/applications/northstar"]'),
  ).toHaveCount(0);
});

test("new sample applications and notes persist only in their tab, and reset removes them", async ({
  page,
  context,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await page.getByLabel("Company", { exact: false }).fill("Paperplane Studio");
  await page.getByLabel("Role", { exact: false }).fill("Product Designer");
  await page.getByRole("button", { name: "Add to demo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Product Designer",
  );
  const applicationURL = page.url();
  await page.getByRole("tab", { name: "Notes & contact" }).click();
  await page
    .getByLabel("Sample notes")
    .fill("A fictional note about a portfolio review.");
  await page.getByRole("button", { name: "Save notes" }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Notes & contact" }).click();
  await expect(page.getByLabel("Sample notes")).toHaveValue(
    "A fictional note about a portfolio review.",
  );
  await expectNoOverflow(page);

  const otherTab = await context.newPage();
  await otherTab.goto("/demo/applications");
  await otherTab
    .getByRole("textbox", { name: "Search applications" })
    .fill("Paperplane");
  await expect(
    otherTab.getByRole("heading", { name: "No matches this time" }),
  ).toBeVisible();
  await otherTab.close();

  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page.getByRole("button", { name: "Reset sample workspace" }).click();
  await expect(page).toHaveURL("/demo");
  await expect(
    page.getByText(
      "Demo reset. The original sample applications are restored.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto(applicationURL);
  await expect(
    page.getByRole("heading", { name: "This sample application isn’t here" }),
  ).toBeVisible();
});

test("the AI and portal previews are clearly fictional and make no external requests", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().startsWith("http") &&
      !request.url().startsWith("http://127.0.0.1:3100/")
    )
      externalRequests.push(request.url());
  });
  await page.goto("/demo/applications/northstar");
  await page.getByRole("button", { name: "Reveal sample password" }).click();
  await expect(
    page.getByText("demo-password-only", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/This is not a secure vault/)).toBeVisible();
  await page.getByRole("button", { name: "Hide sample password" }).click();
  await expect(
    page.getByText("demo-password-only", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View sample analysis" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Precomputed AI example using a fictional resume and job description",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View sample analysis" }),
  ).toBeFocused();
  expect(externalRequests).toEqual([]);
});

for (const savedData of [
  "{broken",
  '{"version":1,"applications":[{"id":"broken"}]}',
]) {
  test(`invalid saved data recovers: ${savedData.slice(0, 12)}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => sessionStorage.setItem("rounza.demo.v1", value),
      savedData,
    );
    await page.goto("/demo/applications");
    await expect(
      page.getByText("10 applications", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your applications.",
    );
  });
}

test("unavailable session storage falls back to a usable memory-only demo", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await page.goto("/demo");
  await expect(page.getByRole("alert")).toHaveText(
    "Session storage is unavailable in this browser. Changes will be lost when you reload.",
  );
  await page
    .getByRole("button", {
      name: "Complete: Follow up on your application",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reopen: Follow up on your application" }),
  ).toBeVisible();
});

import { randomUUID } from "node:crypto";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { signIn, seed, create } from "../helpers/tracking";
test.use({ baseURL: "http://127.0.0.1:3102" });
async function seedJourney(
  request: APIRequestContext,
  token: string,
  table: string,
  rows: Record<string, unknown>[],
) {
  const response = await request.post(
    "http://127.0.0.1:54329/fixture/journey",
    { headers: { Authorization: `Bearer ${token}` }, data: { table, rows } },
  );
  expect(response.ok()).toBe(true);
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Journey record saved.", { exact: true }),
  ).toBeVisible();
}

test("custom repeated rounds, assessments, meeting details and rescheduling persist with history", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  const session = await signIn(context, request);
  const path = await create(page);
  await page.getByRole("link", { name: "Add round", exact: true }).click();
  await page.getByLabel("Round title (required)").fill("Technical interview");
  await page
    .getByLabel("Round status", { exact: true })
    .selectOption("Scheduled");
  await page
    .getByLabel("Meeting date and time", { exact: true })
    .fill("2030-10-01T09:30");
  await page.getByLabel("Meeting time zone (required)").fill("Asia/Tokyo");
  await page
    .getByLabel("Meeting link", { exact: true })
    .fill("https://example.com/meeting");
  await page.getByLabel("Meeting location", { exact: true }).fill("Remote");
  await page
    .getByLabel("People attending", { exact: true })
    .fill("Alex, team lead");
  await page
    .getByLabel("Round notes", { exact: true })
    .fill("Discuss the design system.");
  await page.getByRole("button", { name: "Add round", exact: true }).click();
  await expect(
    page.getByText("Journey record saved.", { exact: true }),
  ).toBeVisible();
  const rounds = page.getByRole("list", { name: "Hiring rounds", exact: true });
  const history = await rounds
    .getByRole("link", { name: "Schedule history", exact: true })
    .getAttribute("href");
  expect(history).toBeTruthy();
  await expect(
    rounds.getByText(/Oct 1, 2030, 9:30 AM · Asia\/Tokyo/),
  ).toBeVisible();
  await expect(
    rounds.getByRole("link", { name: "Open meeting" }),
  ).toHaveAttribute("href", "https://example.com/meeting");
  await rounds.getByRole("link", { name: "Edit or reschedule" }).click();
  await page
    .getByLabel("Meeting date and time", { exact: true })
    .fill("2030-10-03T11:00");
  await page.getByLabel("Duration in minutes (required)").fill("90");
  await page
    .getByLabel("Reason for schedule or status change")
    .fill("Recruiter moved the meeting.");
  await save(page);
  await page.goto(history!);
  const historyList = page.getByRole("list", {
    name: "Schedule history",
    exact: true,
  });
  await expect(historyList.getByRole("listitem")).toHaveCount(2);
  await expect(
    historyList.getByText("Recruiter moved the meeting.", { exact: true }),
  ).toBeVisible();
  await expect(
    historyList.getByText(/Oct 1, 2030, 9:30 AM/).first(),
  ).toBeVisible();
  await expect(historyList.getByText(/Oct 3, 2030, 11:00 AM/)).toBeVisible();
  await page.goto(`${path}/journey/round/new`);
  await page.getByLabel("Round title (required)").fill("Technical interview");
  await page.getByLabel("Journey order (required)").fill("2");
  await page
    .getByLabel("Round type", { exact: true })
    .selectOption("Assessment");
  await page.getByLabel("Assessment or round deadline").fill("2030-10-05");
  await page.getByRole("button", { name: "Add round", exact: true }).click();
  await expect(
    rounds.getByRole("heading", { name: "Technical interview", exact: true }),
  ).toHaveCount(2);
  await signIn(context, request, session.user.id);
  await page.goto(path);
  await expect(rounds.getByRole("listitem")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/app/next-actions?tz=Asia%2FTokyo");
  const actions = page.getByRole("list", { name: "Next actions", exact: true });
  await expect(actions.getByRole("listitem")).toHaveCount(2);
  await expect(actions.getByText(/Oct 3, 2030, 11:00 AM/)).toBeVisible();
  await expect(actions.getByText(/Oct 1, 2030/)).toHaveCount(0);
});

test("preparation tasks complete and reopen, contacts edit, and closed applications pause reminders", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  await signIn(context, request);
  const path = await create(page);
  await page.getByRole("link", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title (required)").fill("Prepare portfolio");
  await page.getByLabel("Task due date").fill("2030-10-01");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const taskList = page.getByRole("list", {
    name: "Preparation tasks",
    exact: true,
  });
  await expect(
    taskList.getByRole("heading", { name: "Prepare portfolio" }),
  ).toBeVisible();
  await taskList.getByRole("button", { name: "Mark complete" }).click();
  await expect(
    taskList.getByRole("button", { name: "Reopen task" }),
  ).toBeVisible();
  await page.goto("/app/next-actions");
  await expect(
    page.getByRole("heading", { name: "Nothing on this page." }),
  ).toBeVisible();
  await page.goto(path);
  await taskList.getByRole("button", { name: "Reopen task" }).click();
  await expect(
    taskList.getByRole("button", { name: "Mark complete" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add contact", exact: true }).click();
  await page.getByLabel("Contact name (required)").fill("Alex Recruiter");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page.getByLabel("Contact role").fill("Recruiting");
  await page.getByRole("button", { name: "Add contact", exact: true }).click();
  await page.getByRole("link", { name: "Edit contact", exact: true }).click();
  await page.getByLabel("Phone number").fill("+1 555 0100");
  await save(page);
  await expect(page.getByText("+1 555 0100", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Edit application", exact: true })
    .click();
  await page
    .getByLabel("Application status", { exact: true })
    .selectOption("Offer");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("This application is closed.", { exact: false }),
  ).toBeVisible();
  await expect(
    taskList.getByRole("heading", { name: "Prepare portfolio" }),
  ).toBeVisible();
  await page.goto("/app/next-actions");
  await expect(page.getByText("0 open actions", { exact: true })).toBeVisible();
  await page.goto(path);
  await page.getByRole("link", { name: "Edit contact", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete contact", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep contact", exact: true }).click();
  await expect(page.getByLabel("Contact name (required)")).toHaveValue(
    "Alex Recruiter",
  );
  await page
    .getByRole("button", { name: "Delete contact", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByText("Journey record deleted.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Alex Recruiter", { exact: true })).toHaveCount(
    0,
  );
});

test("invalid links, clock-change times and failed writes preserve the draft", async ({
  page,
  context,
  request,
}) => {
  const owner = await signIn(context, request);
  const path = await create(page);
  await page.goto(`${path}/journey/round/new`);
  await page.getByLabel("Round title (required)").fill("Private draft");
  await page
    .getByLabel("Round notes", { exact: true })
    .fill("Keep this preparation.");
  await page
    .getByLabel("Meeting link", { exact: true })
    .fill("https://user:password@example.com");
  await page.getByRole("button", { name: "Add round", exact: true }).click();
  await expect(
    page.getByText(
      "Enter a complete http:// or https:// URL without login credentials.",
    ),
  ).toBeVisible();
  await page.getByLabel("Meeting link", { exact: true }).fill("");
  await page
    .getByLabel("Round status", { exact: true })
    .selectOption("Scheduled");
  await page
    .getByLabel("Meeting time zone (required)")
    .fill("America/New_York");
  await page
    .getByLabel("Meeting date and time", { exact: true })
    .fill("2026-03-08T02:30");
  await page.getByRole("button", { name: "Add round", exact: true }).click();
  await expect(page.getByText(/This local time does not exist/)).toBeVisible();
  await page
    .getByLabel("Meeting date and time", { exact: true })
    .fill("2026-11-01T01:30");
  await page.getByRole("button", { name: "Add round", exact: true }).click();
  await expect(page.getByText(/This time occurs twice/)).toBeVisible();
  await page.getByLabel("Clock-change occurrence").selectOption("later");
  await signIn(context, request, owner.user.id, "&writeError=1");
  await page.getByRole("button", { name: "Add round", exact: true }).click();
  await expect(page.getByText(/We couldn’t save this change/)).toBeVisible();
  await expect(page.getByLabel("Round notes", { exact: true })).toHaveValue(
    "Keep this preparation.",
  );
});

test("stale edits and changed accounts cannot overwrite another saved journey", async ({
  page,
  context,
  request,
}) => {
  const owner = await signIn(context, request);
  const appId = randomUUID(),
    roundId = randomUUID();
  await seed(request, owner.access_token, [
    { id: appId, company: "Private journey" },
  ]);
  await seedJourney(request, owner.access_token, "hiring_rounds", [
    { id: roundId, application_id: appId, title: "Private round" },
  ]);
  const path = `/app/applications/${appId}`,
    edit = `${path}/journey/round/${roundId}/edit`;
  await page.goto(edit);
  const other = await context.newPage();
  await other.goto(edit);
  await other
    .getByLabel("Round notes", { exact: true })
    .fill("Newer saved notes.");
  await save(other);
  await page.getByLabel("Round notes", { exact: true }).fill("Older draft.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText(/This record changed or is no longer available/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByLabel("Round notes", { exact: true })).toHaveValue(
    "Older draft.",
  );
  await other.reload();
  await expect(
    other.getByText("Newer saved notes.", { exact: true }),
  ).toBeVisible();
  await page.goto(edit);
  await signIn(context, request);
  await page
    .getByLabel("Round notes", { exact: true })
    .fill("Unauthorized change");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.goto(`${path}/journey/round/${roundId}`);
  await expect(
    page.getByRole("heading", { name: "Application not found." }),
  ).toBeVisible();
  await page.goto("/app/next-actions");
  await expect(page.getByText("Private round", { exact: true })).toHaveCount(0);
  await signIn(context, request, owner.user.id);
  await page.goto(path);
  await expect(
    page.getByText("Newer saved notes.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unauthorized change", { exact: true }),
  ).toHaveCount(0);
  await other.close();
});

test("round-linked tasks survive round deletion while its history and reminders disappear", async ({
  page,
  context,
  request,
}) => {
  const owner = await signIn(context, request);
  const appId = randomUUID(),
    roundId = randomUUID();
  await seed(request, owner.access_token, [{ id: appId }]);
  await seedJourney(request, owner.access_token, "hiring_rounds", [
    { id: roundId, application_id: appId, title: "Optional round" },
  ]);
  const path = `/app/applications/${appId}`;
  await page.goto(path);
  await page
    .getByRole("link", { name: "Add preparation task", exact: true })
    .click();
  await page.getByLabel("Task title (required)").fill("Keep useful research");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View linked round", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Edit or reschedule", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete round", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "preparation tasks will stay",
  );
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByRole("heading", { name: "Keep useful research", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View linked round", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${path}/journey/round/${roundId}`);
  await expect(
    page.getByRole("heading", { name: "Application not found." }),
  ).toBeVisible();
  await page.goto("/app/next-actions");
  await expect(
    page
      .getByRole("list", { name: "Next actions", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Keep useful research", exact: true }),
  ).toBeVisible();
});

test("next-action and journey pagination cover all records, with stable filters", async ({
  page,
  context,
  request,
}) => {
  const owner = await signIn(context, request);
  const appId = randomUUID();
  await seed(request, owner.access_token, [{ id: appId }]);
  await seedJourney(
    request,
    owner.access_token,
    "preparation_tasks",
    Array.from({ length: 23 }, (_, i) => ({
      application_id: appId,
      title: `Task ${i}`,
      due_on: i === 22 ? "2000-01-01" : "2099-01-01",
    })),
  );
  await page.goto("/app/next-actions");
  await expect(
    page
      .getByRole("list", { name: "Next actions", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(20);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Next actions", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(3);
  await page.getByLabel("Show actions", { exact: true }).selectOption("0");
  await page
    .getByLabel("Day grouping time zone", { exact: true })
    .fill("Asia/Tokyo");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Next actions", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Task 22", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Day grouping time zone", { exact: true }),
  ).toHaveValue("Asia/Tokyo");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/app/applications/${appId}`);
  await expect(
    page
      .getByRole("list", { name: "Preparation tasks", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(20);
  await page
    .getByRole("navigation", { name: "Task pages" })
    .getByRole("link", { name: "Next page" })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Preparation tasks", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(3);
  await page.goto("/app/next-actions?page=999");
  await expect(
    page.getByRole("link", { name: "Back to first page" }),
  ).toBeVisible();
});

import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { signIn } from "../helpers/tracking";
import { docxFile, pdfFile } from "../fixtures/resume-files";
test.use({ baseURL: "http://127.0.0.1:3102" });
const reviewed = "I have reviewed this text and it is ready to save.";
async function saved(request: APIRequestContext, token: string) {
  const response = await request.get("http://127.0.0.1:54329/fixture/resumes", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function paste(
  page: Page,
  name = "Designer resume",
  body = "Fictional candidate\nExperience: built useful software.",
) {
  await page.goto("/app/resumes/new");
  await page.getByLabel("Resume name (required)").fill(name);
  await page.getByLabel("Resume text (required)").fill(body);
  await expect(
    page.getByRole("button", { name: "Save resume", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(reviewed).check();
  await page.getByRole("button", { name: "Save resume", exact: true }).click();
  await expect(page.getByText("Resume saved.", { exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}
async function file(
  page: Page,
  name: string,
  buffer: Buffer,
  mimeType = "application/octet-stream",
) {
  await page
    .getByLabel("Import PDF or DOCX", { exact: true })
    .setInputFiles({ name, buffer, mimeType });
}
test("pasted versions save only after review, persist, edit and delete with confirmation", async ({
  page,
  context,
  request,
}) => {
  const session = await signIn(context, request);
  const path = await paste(page);
  await page.reload();
  await expect(
    page.getByText(/Experience: built useful software/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit resume", exact: true }).click();
  await page.getByLabel(reviewed).check();
  await page
    .getByLabel("Resume text (required)")
    .fill("Updated fictional work experience");
  await expect(page.getByLabel(reviewed)).not.toBeChecked();
  await page.getByLabel("Resume name (required)").fill("Designer September");
  await page.getByLabel(reviewed).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Designer September", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Updated fictional work experience", { exact: true }),
  ).toBeVisible();
  await signIn(context, request, session.user.id);
  await page.goto("/app/resumes");
  await page
    .getByRole("link", { name: "Designer September", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep resume", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Designer September", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(
    page.getByText("Resume deleted.", { exact: true }),
  ).toBeVisible();
  expect(await saved(request, session.access_token)).toHaveLength(0);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Resume not found.", exact: true }),
  ).toBeVisible();
});
test("PDF extraction stays local until the reviewed text is saved, with no original file upload", async ({
  page,
  context,
  request,
}) => {
  const session = await signIn(context, request);
  const outgoing: string[] = [];
  page.on("request", (req) =>
    outgoing.push(req.url() + (req.postData() ?? "")),
  );
  await page.goto("/app/resumes/new");
  await file(
    page,
    "Fictional PDF resume.pdf",
    pdfFile(["PDF_PRIVATE_MARKER_9827", "Second page experience"]),
    "application/pdf",
  );
  await expect(page.getByLabel("Extracted text preview")).toHaveValue(
    /PDF_PRIVATE_MARKER_9827/,
  );
  expect(outgoing.join("\n")).not.toContain("PDF_PRIVATE_MARKER_9827");
  expect(outgoing.join("\n")).not.toContain("%PDF-1.4");
  expect(await saved(request, session.access_token)).toHaveLength(0);
  await page
    .getByRole("button", { name: "Use extracted text", exact: true })
    .click();
  await expect(page.getByLabel("Resume name (required)")).toHaveValue(
    "Fictional PDF resume",
  );
  await expect(page.getByLabel("Resume text (required)")).toHaveValue(
    /Second page experience/,
  );
  await page
    .getByLabel("Resume text (required)")
    .fill("Reviewed and corrected PDF experience");
  await page.getByLabel(reviewed).check();
  await page.getByRole("button", { name: "Save resume", exact: true }).click();
  await expect(page.getByText("Resume saved.", { exact: true })).toBeVisible();
  const rows = await saved(request, session.access_token);
  expect(rows).toHaveLength(1);
  expect(rows[0].body).toBe("Reviewed and corrected PDF experience");
  expect(rows[0].source).toBe("pdf");
  expect(outgoing.join("\n")).not.toContain("PDF_PRIVATE_MARKER_9827");
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
test("DOCX imports Unicode as plain text and replacement requires an explicit choice", async ({
  page,
  context,
  request,
}) => {
  await signIn(context, request);
  const path = await paste(page);
  await page.goto(`${path}/edit`);
  const text = "Fictional 🦉 candidate <img src=x onerror=alert(1)> & 日本語";
  await file(page, "Replacement.docx", docxFile(text));
  await expect(page.getByLabel("Extracted text preview")).toHaveValue(text);
  await page
    .getByRole("button", { name: "Discard import", exact: true })
    .click();
  await expect(page.getByLabel("Resume text (required)")).toHaveValue(
    /Fictional candidate/,
  );
  await file(page, "Replacement.docx", docxFile(text));
  await page
    .getByRole("button", { name: "Use extracted text", exact: true })
    .click();
  await expect(page.getByLabel("Resume name (required)")).toHaveValue(
    "Designer resume",
  );
  await page.getByLabel(reviewed).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("unsupported, empty, damaged, scanned, protected and oversized files preserve the draft", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  await signIn(context, request);
  await page.goto("/app/resumes/new");
  await page.getByLabel("Resume text (required)").fill("Keep this draft");
  const cases = [
    { name: "old.doc", data: Buffer.from("doc"), message: /Older .doc files/ },
    { name: "empty.pdf", data: Buffer.alloc(0), message: /file is empty/ },
    {
      name: "damaged.pdf",
      data: Buffer.from("%PDF-1.4 broken"),
      message: /PDF could not be read/,
    },
    {
      name: "damaged.docx",
      data: Buffer.from("not zip"),
      message: /not a readable DOCX/,
    },
    { name: "scan.pdf", data: pdfFile([""]), message: /No readable text/ },
    {
      name: "protected.pdf",
      data: pdfFile(["Protected"], true),
      message: /Password-protected PDFs/,
    },
    {
      name: "long.pdf",
      data: pdfFile(Array.from({ length: 51 }, () => "Page")),
      message: /more than 50 pages/,
    },
    {
      name: "large.docx",
      data: Buffer.alloc(5 * 1024 * 1024 + 1),
      message: /smaller than 5 MB/,
    },
  ];
  for (const item of cases) {
    await file(page, item.name, item.data);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      item.message,
    );
    await expect(page.getByLabel("Resume text (required)")).toHaveValue(
      "Keep this draft",
    );
  }
});
test("failed writes retain text and changing account prevents saving the old draft", async ({
  page,
  context,
  request,
}) => {
  const owner = await signIn(context, request);
  await page.goto("/app/resumes/new");
  await page.getByLabel("Resume name (required)").fill("Private draft");
  await page.getByLabel("Resume text (required)").fill("Do not lose this text");
  await page.getByLabel(reviewed).check();
  await signIn(context, request, owner.user.id, "&writeError=1");
  await page.getByRole("button", { name: "Save resume", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "We couldn’t save this resume",
  );
  await expect(page.getByLabel("Resume text (required)")).toHaveValue(
    "Do not lose this text",
  );
  await expect(page.getByLabel(reviewed)).toBeChecked();
  await signIn(context, request, owner.user.id);
  await page.getByRole("button", { name: "Save resume", exact: true }).click();
  await expect(page.getByText("Resume saved.", { exact: true })).toBeVisible();
  const rows = await saved(request, owner.access_token);
  expect(rows).toHaveLength(1);
  expect(rows[0].body).toBe("Do not lose this text");
  await page.goto("/app/resumes/new");
  await page.getByLabel("Resume name (required)").fill("Another private draft");
  await page
    .getByLabel("Resume text (required)")
    .fill("Must stay with its owner");
  await page.getByLabel(reviewed).check();
  const other = await signIn(context, request);
  await page.getByRole("button", { name: "Save resume", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your account changed",
  );
  expect(await saved(request, other.access_token)).toHaveLength(0);
  expect(await saved(request, owner.access_token)).toHaveLength(1);
});
test("stale edits and deletion confirmations cannot replace newer resume text", async ({
  page,
  context,
  request,
}) => {
  test.slow();
  await signIn(context, request);
  const path = await paste(page);
  await page.goto(`${path}/edit`);
  const other = await context.newPage();
  await other.goto(`${path}/edit`);
  await other
    .getByLabel("Resume text (required)")
    .fill("New version in another tab");
  await other.getByLabel(reviewed).check();
  await other
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(other.getByText("Resume saved.", { exact: true })).toBeVisible();
  await page.getByLabel("Resume text (required)").fill("Stale draft");
  await page.getByLabel(reviewed).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "This resume changed",
  );
  await expect(page.getByLabel("Resume text (required)")).toHaveValue(
    "Stale draft",
  );
  await page.goto(path);
  await page
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await other.goto(`${path}/edit`);
  await other
    .getByLabel("Resume text (required)")
    .fill("Newest protected revision");
  await other.getByLabel(reviewed).check();
  await other
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(other.getByText("Resume saved.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "This resume changed",
  );
  await other.reload();
  await expect(
    other.getByText("Newest protected revision", { exact: true }),
  ).toBeVisible();
  await other.close();
});
test("library pagination and not-found results remain scoped to the signed-in account", async ({
  page,
  context,
  request,
}) => {
  const owner = await signIn(context, request);
  await request.post("http://127.0.0.1:54329/fixture/resumes", {
    headers: { Authorization: `Bearer ${owner.access_token}` },
    data: Array.from({ length: 23 }, (_, index) => ({
      name: `Version ${index}`,
      body: `Private full text ${index}`,
    })),
  });
  await page.goto("/app/resumes");
  const library = page.getByRole("list", {
    name: "Saved resumes",
    exact: true,
  });
  await expect(library.getByRole("listitem")).toHaveCount(20);
  await expect(page.getByText(/Private full text/)).toHaveCount(0);
  const href = await library.getByRole("link").first().getAttribute("href");
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(library.getByRole("listitem")).toHaveCount(3);
  await page.goto("/app/resumes?page=999");
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await signIn(context, request);
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { name: "Resume not found.", exact: true }),
  ).toBeVisible();
  await page.goto("/app/resumes");
  await expect(
    page.getByRole("heading", {
      name: "A place for every version.",
      exact: true,
    }),
  ).toBeVisible();
});
test("cancelled and timed-out imports clear pending work without replacing text", async ({
  page,
  context,
  request,
}) => {
  await signIn(context, request);
  // A deliberately unresponsive DOCX worker verifies timeout/cancel boundaries.
  await page.addInitScript(() => {
    window.Worker = class {
      postMessage() {}
      terminate() {}
    } as unknown as typeof Worker;
  });
  await page.clock.install();
  await page.goto("/app/resumes/new");
  await page.getByLabel("Resume text (required)").fill("Keep local draft");
  await file(page, "slow.docx", docxFile());
  await expect(
    page.getByText("Reading your file on this device…", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  await expect(page.getByLabel("Extracted text preview")).toHaveCount(0);
  await expect(page.getByLabel("Resume text (required)")).toHaveValue(
    "Keep local draft",
  );
  await file(page, "slow.docx", docxFile());
  await expect(
    page.getByText("Reading your file on this device…", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Import took too long",
  );
  await expect(page.getByLabel("Resume text (required)")).toHaveValue(
    "Keep local draft",
  );
});

import {
  test,
  expect,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
const fixture = "http://127.0.0.1:54329",
  site = "http://127.0.0.1:3102";
test.use({ baseURL: site });
async function setup(
  context: BrowserContext,
  request: APIRequestContext,
  enabled = true,
) {
  const session = await (
    await request.get(`${fixture}/fixture/session?user=fresh`)
  ).json();
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
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const app = randomUUID(),
    client = randomUUID();
  await request.post(`${fixture}/fixture/applications`, {
    headers,
    data: [
      {
        id: app,
        company: "Review company",
        role: "Engineer",
        notes: "Original notes",
      },
    ],
  });
  const c = await (
    await request.post(`${fixture}/rest/v1/ai_connections`, {
      headers,
      data: {
        user_id: session.user.id,
        client_id: client,
        client_name: "Review assistant",
        application_access: "all",
        application_ids: [],
        resume_access: "all",
        resume_ids: [],
        allow_proposals: enabled,
        revoked_at: null,
      },
    })
  ).json();
  const delegated = await (
    await request.get(`${fixture}/fixture/delegated?client_id=${client}`, {
      headers,
    })
  ).json();
  return {
    session,
    headers,
    app,
    connection: c[0],
    token: delegated.access_token,
  };
}
async function tool(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown>,
) {
  const response = await request.post(`${site}/mcp`, {
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
  expect(response.status()).toBe(200);
  return (await response.json()).result;
}
const proposal = (app: string, title = "Update my application") => ({
  idempotency_key: randomUUID(),
  title,
  summary: "Use the notes I just provided.",
  changes: [
    {
      entity: "application",
      action: "update",
      record_id: app,
      expected_revision: 1,
      data: { notes: "Proposed notes" },
    },
  ],
});
test("assistant proposals require opt-in, show before and after, and apply only after website approval", async ({
  page,
  context,
  request,
}) => {
  const s = await setup(context, request, false),
    p = proposal(s.app);
  expect((await tool(request, s.token, "submit_proposal", p)).isError).toBe(
    true,
  );
  await page.goto(`/app/ai-connections/${s.connection.id}`);
  await page
    .getByRole("checkbox", { name: "Allow this assistant to submit proposals" })
    .check();
  await page
    .getByRole("button", { name: "Save permissions", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Permissions updated");
  const result = await tool(request, s.token, "submit_proposal", p);
  expect(result.isError).not.toBe(true);
  const id = result.structuredContent.proposal.id;
  const duplicate = await tool(request, s.token, "submit_proposal", p);
  expect(duplicate.structuredContent.proposal.id).toBe(id);
  const before = await tool(request, s.token, "get_application", { id: s.app });
  expect(before.structuredContent.application.notes).toBe("Original notes");
  await page.goto("/app/review-inbox");
  await expect(
    page.getByRole("link", { name: p.title, exact: true }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: p.title, exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your records have not changed",
  );
  await expect(page.getByText("Original notes", { exact: true })).toBeVisible();
  await expect(page.getByText("Proposed notes", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve all changes" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "I reviewed every change" }).check();
  await page.getByRole("button", { name: "Approve all changes" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Approved. All changes were applied together.",
  );
  const after = await tool(request, s.token, "get_application", { id: s.app });
  expect(after.structuredContent.application.notes).toBe("Proposed notes");
  const status = await tool(request, s.token, "get_proposal_status", { id });
  expect(status.structuredContent.proposal.status).toBe("approved");
  expect(status.structuredContent.proposal.changes).toBeUndefined();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Approve all changes" }),
  ).toHaveCount(0);
});
test("stale batches preserve every record and can be rejected", async ({
  page,
  context,
  request,
}) => {
  const s = await setup(context, request),
    p = proposal(s.app),
    cv = randomUUID();
  const result = await tool(request, s.token, "submit_proposal", {
    ...p,
    changes: [
      {
        entity: "resume",
        action: "create",
        record_id: cv,
        data: { name: "Pending CV", body: "Pending resume text" },
      },
      ...p.changes,
    ],
  });
  expect(result.isError).not.toBe(true);
  const id = result.structuredContent.proposal.id;
  await page.goto(`/app/review-inbox/${id}`);
  await request.patch(
    `${fixture}/rest/v1/applications?user_id=eq.${s.session.user.id}&id=eq.${s.app}&revision=eq.1`,
    { headers: s.headers, data: { notes: "Newer edit" } },
  );
  await page.getByRole("checkbox", { name: "I reviewed every change" }).check();
  await page.getByRole("button", { name: "Approve all changes" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Nothing was applied" }),
  ).toBeVisible();
  expect((await tool(request, s.token, "get_resume", { id: cv })).isError).toBe(
    true,
  );
  expect(
    (await tool(request, s.token, "get_application", { id: s.app }))
      .structuredContent.application.notes,
  ).toBe("Newer edit");
  await page.getByRole("button", { name: "Reject proposal" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Rejected. No changes were applied.",
  );
  expect(
    (await tool(request, s.token, "get_proposal_status", { id }))
      .structuredContent.proposal.status,
  ).toBe("rejected");
});
test("revoked proposal permission blocks approval and inbox pagination remains private", async ({
  page,
  context,
  request,
}) => {
  const s = await setup(context, request);
  let id = "";
  for (let i = 0; i < 21; i++) {
    const result = await tool(
      request,
      s.token,
      "submit_proposal",
      proposal(s.app, `Suggestion ${String(i).padStart(2, "0")}`),
    );
    expect(result.isError).not.toBe(true);
    id = result.structuredContent.proposal.id;
  }
  await page.goto("/app/review-inbox");
  await expect(
    page.getByRole("link", { name: "Review proposal", exact: true }),
  ).toHaveCount(20);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Review proposal", exact: true }),
  ).toHaveCount(1);
  const other = await request.get(`${fixture}/fixture/session?user=fresh`);
  const otherSession = await other.json();
  const hidden = await request.get(
    `${fixture}/rest/v1/ai_proposals?user_id=eq.${otherSession.user.id}&id=eq.${id}`,
    { headers: { Authorization: `Bearer ${otherSession.access_token}` } },
  );
  expect(await hidden.json()).toEqual([]);
  await page.goto(`/app/review-inbox/${id}`);
  await request.patch(
    `${fixture}/rest/v1/ai_connections?user_id=eq.${s.session.user.id}&id=eq.${s.connection.id}`,
    { headers: s.headers, data: { allow_proposals: false } },
  );
  await page.getByRole("checkbox", { name: "I reviewed every change" }).check();
  await page.getByRole("button", { name: "Approve all changes" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Nothing was applied" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reject proposal" }).click();
  await expect(page.getByRole("status")).toContainText("Rejected.");
});

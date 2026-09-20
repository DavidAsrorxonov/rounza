import {
  expect,
  test,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";

test("unconfigured accounts are clear and the demo still works", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make yourself at home." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Account sign-in is not available yet.", { exact: false }),
  ).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL("/login");
  await page.getByRole("link", { name: "Try the demo first" }).click();
  await expect(page).toHaveURL("/demo");
});

test.describe("configured accounts with a local provider fixture", () => {
  test.use({ baseURL: "http://127.0.0.1:3102" });

  async function seedSession(
    context: BrowserContext,
    request: APIRequestContext,
    options = "",
  ) {
    const response = await request.get(
      `http://127.0.0.1:54329/fixture/session?${options}`,
    );
    const session = await response.json();
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

  test("Google PKCE sign-in, private reload, and sign-out work end to end", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL("/app");
    await expect(
      page.getByText("alice@example.com", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your space is ready." }),
    ).toBeVisible();
    expect(
      (await context.cookies())
        .filter((cookie) => cookie.name.includes("auth-token"))
        .every((cookie) => cookie.httpOnly),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByText("alice@example.com", { exact: true }),
    ).toBeVisible();
    await page.goto("/login");
    await expect(page).toHaveURL("/app");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL("/login?signedOut=1");
    await expect(page.getByRole("status")).toHaveText(
      "You’re signed out of this browser.",
    );
    await page.goto("/app");
    await expect(page).toHaveURL("/login");
  });

  test("cancelled and invalid callbacks show safe retry messages without external redirects", async ({
    page,
    request,
  }) => {
    await page.goto(
      "/auth/callback?error=access_denied&error_description=untrusted-provider-message",
    );
    await expect(
      page.getByText("Google sign-in was cancelled or declined.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByText("untrusted-provider-message")).toHaveCount(0);
    for (const code of [
      "",
      "?code=invalid&next=https://evil.example&returnTo=//evil.example",
    ]) {
      const response = await request.get(`/auth/callback${code}`, {
        maxRedirects: 0,
        headers: { "x-forwarded-host": "evil.example" },
      });
      expect(response.status()).toBe(303);
      expect(response.headers().location).toBe(
        "http://127.0.0.1:3102/login?error=callback",
      );
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  });

  test("tampered sessions cannot reveal private data", async ({
    page,
    context,
    request,
  }) => {
    const session = await seedSession(context, request);
    const parts = session.access_token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    payload.sub = "22222222-2222-4222-8222-222222222222";
    parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
    session.access_token = parts.join(".");
    session.user.email = "bob@example.com";
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.goto("/app");
    await expect(page).toHaveURL("/login");
    await expect(page.getByText("bob@example.com")).toHaveCount(0);
  });

  test("expired access tokens refresh into HttpOnly cookies and remain private", async ({
    page,
    context,
    request,
  }) => {
    const old = await seedSession(context, request, "user=bob&expired=1");
    const response = await page.goto("/app");
    await expect(
      page.getByText("bob@example.com", { exact: true }),
    ).toBeVisible();
    expect(response?.headers()["cache-control"]).toContain("no-store");
    const cookies = (await context.cookies()).filter((cookie) =>
      cookie.name.includes("auth-token"),
    );
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.every((cookie) => cookie.httpOnly)).toBe(true);
    expect(cookies.map((cookie) => cookie.value).join("")).not.toContain(
      Buffer.from(JSON.stringify(old)).toString("base64url"),
    );
    await page.reload();
    await expect(
      page.getByText("bob@example.com", { exact: true }),
    ).toBeVisible();
  });

  test("separate users and the public demo never share account data", async ({
    page,
    context,
    browser,
    request,
  }) => {
    await seedSession(context, request, "user=alice");
    await page.goto("/app");
    await expect(
      page.getByText("alice@example.com", { exact: true }),
    ).toBeVisible();
    const other = await browser.newContext();
    try {
      await seedSession(other, request, "user=bob");
      const bob = await other.newPage();
      await bob.goto("http://127.0.0.1:3102/app");
      await expect(
        bob.getByText("bob@example.com", { exact: true }),
      ).toBeVisible();
      await expect(bob.getByText("alice@example.com")).toHaveCount(0);
      await page.getByRole("link", { name: "Explore the demo" }).click();
      await expect(page.getByText("alice@example.com")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test("database failure is visible and keeps sign-out available", async ({
    page,
    context,
    request,
  }) => {
    await seedSession(context, request, "databaseError=1");
    await page.goto("/app");
    await expect(
      page.getByRole("heading", { name: "Your workspace couldn’t load." }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
  });
});

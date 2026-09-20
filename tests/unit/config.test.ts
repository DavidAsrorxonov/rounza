import assert from "node:assert/strict";
import test from "node:test";
import { getSupabaseConfig } from "../../src/lib/supabase/config";
import { demoDataSchema } from "../../src/features/demo/model";
import { createDemoData } from "../../src/features/demo/seed";

test("auth config fails closed for incomplete, unsafe, or secret-key configuration", () => {
  const original = { ...process.env };
  try {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.SITE_URL = "http://localhost:3000";
    assert.equal(getSupabaseConfig()?.origin, "http://localhost:3000");
    for (const invalid of [
      "",
      "http://public.example.com",
      "https://user:pass@example.com",
      "https://example.com/path",
      "https://example.com?next=bad",
      "javascript:alert(1)",
    ]) {
      process.env.SITE_URL = invalid;
      assert.equal(getSupabaseConfig(), null);
    }
    process.env.SITE_URL = "https://rounza.example.com";
    for (const invalid of [
      "",
      "sb_secret_test",
      "service_role",
      "eyJlegacy-key",
    ]) {
      process.env.SUPABASE_PUBLISHABLE_KEY = invalid;
      assert.equal(getSupabaseConfig(), null);
    }
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.SUPABASE_URL = "http://remote.example.com";
    assert.equal(getSupabaseConfig(), null);
  } finally {
    process.env = original;
  }
});

test("demo storage rejects impossible calendar dates instead of normalizing them", () => {
  const data = createDemoData();
  data.applications[0].addedOn = "2026-02-31";
  assert.equal(demoDataSchema.safeParse(data).success, false);
  data.applications[0].addedOn = "2028-02-29";
  assert.equal(demoDataSchema.safeParse(data).success, true);
  data.applications[0].rounds[0].scheduledAt = "2026-02-31T12:00";
  assert.equal(demoDataSchema.safeParse(data).success, false);
});

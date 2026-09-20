import "server-only";

/** Kept on the server: this milestone has no browser database client. */
export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const siteUrl = process.env.SITE_URL?.trim();
  if (!url || !key || !siteUrl) return null;

  try {
    const project = new URL(url);
    const site = new URL(siteUrl);
    for (const parsed of [project, site]) {
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(
        parsed.hostname,
      );
      if (
        parsed.protocol !== "https:" &&
        !(local && parsed.protocol === "http:")
      )
        return null;
      if (
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      )
        return null;
    }
    // Secret/service-role keys never belong in the app's RLS-scoped client.
    if (!key.startsWith("sb_publishable_")) return null;
    return { url: project.origin, key, origin: site.origin };
  } catch {
    return null;
  }
}

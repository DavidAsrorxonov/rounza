import { z } from "zod";
import { getAccount } from "@/lib/auth/account";
const input = z.object({
  kind: z.enum(["applications", "resumes"]),
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json(
      { error: "Sign in required." },
      { status: 401, headers },
    );
  const parsed = input.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return Response.json(
      { error: "Invalid search." },
      { status: 400, headers },
    );
  const { kind, q, page } = parsed.data;
  const { supabase, user } = account;
  const start = (page - 1) * 20;
  if (kind === "applications") {
    const { data, error } = await supabase
      .rpc("search_applications", { search_term: q })
      .select("id,company,role")
      .eq("user_id", user.id)
      .order("company")
      .order("id")
      .range(start, start + 20);
    if (error)
      return Response.json(
        { error: "Search unavailable." },
        { status: 503, headers },
      );
    return Response.json(
      {
        items: (data ?? [])
          .slice(0, 20)
          .map((r) => ({ id: r.id, label: `${r.company} — ${r.role}` })),
        has_more: (data?.length ?? 0) > 20,
      },
      { headers },
    );
  }
  const { data, error } = await supabase
    .from("resumes")
    .select("id,name")
    .eq("user_id", user.id)
    .ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`)
    .order("name")
    .order("id")
    .range(start, start + 20);
  if (error)
    return Response.json(
      { error: "Search unavailable." },
      { status: 503, headers },
    );
  return Response.json(
    {
      items: (data ?? [])
        .slice(0, 20)
        .map((r) => ({ id: r.id, label: r.name })),
      has_more: (data?.length ?? 0) > 20,
    },
    { headers },
  );
}

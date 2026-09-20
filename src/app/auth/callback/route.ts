import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = getSupabaseConfig();
  const supabase = await createClient();
  let destination = "/login?error=callback";
  if (!config || !supabase) destination = "/login?error=configuration";
  else if (url.searchParams.has("error")) destination = "/login?error=denied";
  else {
    const code = url.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) destination = "/app";
    }
  }
  // Fixed destinations and a configured origin prevent open/forwarded-host redirects.
  // With no configuration only a relative, same-origin login redirect is allowed.
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: config ? new URL(destination, config.origin).href : destination,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
  return response;
}

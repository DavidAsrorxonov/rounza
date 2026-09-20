import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  let response = NextResponse.next({ request });
  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.origin.startsWith("https:"),
        path: "/",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    // Refresh only. The data layer verifies identity again before every read.
    // An unavailable provider must not turn the login page into a server error.
    try {
      await supabase.auth.getClaims();
    } catch {
      /* Handled by the data layer. */
    }
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = { matcher: ["/app/:path*", "/login", "/auth/:path*"] };

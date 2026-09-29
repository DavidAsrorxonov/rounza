import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import type { getMcpConfig } from "./config";
type Config = NonNullable<ReturnType<typeof getMcpConfig>>;
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authenticateMcp(request: Request, config: Config) {
  const match = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/i);
  if (!match || match[1].length > 16384) return null;
  const token = match[1];
  let keys = keySets.get(config.issuer);
  if (!keys) {
    keys = createRemoteJWKSet(
      new URL(`${config.issuer}/.well-known/jwks.json`),
      { timeoutDuration: 5000 },
    );
    keySets.set(config.issuer, keys);
  }
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: config.issuer,
      audience: config.resource,
      algorithms: ["ES256", "RS256"],
      requiredClaims: ["sub", "exp", "iat", "session_id", "client_id"],
    });
    if (
      payload.aud !== config.resource ||
      payload.role !== "authenticated" ||
      payload.is_anonymous !== false ||
      !z.uuid().safeParse(payload.sub).success ||
      !z.uuid().safeParse(payload.client_id).success ||
      !z.uuid().safeParse(payload.session_id).success
    )
      return null;
    const supabase = createClient<Database>(config.url, config.key, {
      accessToken: async () => token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
    const { data, error } = await supabase.rpc("ai_connection_status");
    if (error || data !== true) return null;
    return {
      supabase,
      userId: payload.sub as string,
      clientId: payload.client_id as string,
      origin: config.origin,
    };
  } catch {
    return null;
  }
}
export type AgentContext = NonNullable<
  Awaited<ReturnType<typeof authenticateMcp>>
>;

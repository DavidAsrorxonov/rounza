import "server-only";
import { getSupabaseConfig } from "@/lib/supabase/config";
export function getMcpConfig() {
  const config = getSupabaseConfig();
  if (!config || process.env.MCP_ENABLED !== "true") return null;
  return {
    ...config,
    resource: `${config.origin}/mcp`,
    issuer: `${config.url}/auth/v1`,
    metadata: `${config.origin}/.well-known/oauth-protected-resource/mcp`,
  };
}

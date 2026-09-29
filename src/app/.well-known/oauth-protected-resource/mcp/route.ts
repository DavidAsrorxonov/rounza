import { getMcpConfig } from "@/lib/mcp/config";
export const dynamic = "force-dynamic";
export function GET() {
  const config = getMcpConfig();
  const headers = {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };
  if (!config)
    return Response.json(
      { error: "AI connections are not configured." },
      { status: 503, headers },
    );
  return Response.json(
    {
      resource: config.resource,
      authorization_servers: [config.issuer],
      scopes_supported: ["openid"],
      bearer_methods_supported: ["header"],
      resource_name: "Rounza",
    },
    { headers },
  );
}

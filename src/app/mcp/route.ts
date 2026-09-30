import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpConfig } from "@/lib/mcp/config";
import { authenticateMcp } from "@/lib/mcp/auth";
import { createRounzaMcp } from "@/lib/mcp/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  const config = getMcpConfig();
  if (!config)
    return Response.json(
      { error: "AI connections are not configured." },
      { status: 503, headers: privateHeaders },
    );
  const origin = request.headers.get("origin");
  if (
    origin &&
    ![config.origin, "https://chatgpt.com", "https://claude.ai"].includes(
      origin,
    )
  )
    return Response.json(
      { error: "Origin is not allowed." },
      { status: 403, headers: privateHeaders },
    );
  const context = await authenticateMcp(request, config);
  const headers: Record<string, string> = { ...privateHeaders, Vary: "Origin" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Expose-Headers"] = "WWW-Authenticate";
  }
  if (!context)
    return Response.json(
      { error: "Connect or reconnect your assistant through Rounza." },
      {
        status: 401,
        headers: {
          ...headers,
          "WWW-Authenticate": `Bearer resource_metadata="${config.metadata}", scope="openid"`,
        },
      },
    );
  const server = createRounzaMcp(context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 262144,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    for (const [key, value] of Object.entries(headers))
      response.headers.set(key, value);
    return response;
  } catch {
    return Response.json(
      { error: "MCP request failed." },
      { status: 500, headers },
    );
  } finally {
    await server.close();
  }
}
export function GET() {
  return new Response(null, {
    status: 405,
    headers: { ...privateHeaders, Allow: "POST, OPTIONS" },
  });
}
export const DELETE = GET;
export function OPTIONS(request: Request) {
  const config = getMcpConfig();
  const origin = request.headers.get("origin");
  if (
    !config ||
    !origin ||
    ![config.origin, "https://chatgpt.com", "https://claude.ai"].includes(
      origin,
    )
  )
    return new Response(null, { status: 403, headers: privateHeaders });
  return new Response(null, {
    status: 204,
    headers: {
      ...privateHeaders,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Accept, MCP-Protocol-Version",
      "Access-Control-Expose-Headers": "WWW-Authenticate",
      Vary: "Origin",
    },
  });
}

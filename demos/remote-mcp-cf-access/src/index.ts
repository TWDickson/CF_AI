import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleAccessRequest } from "./access-handler";
import type { Props } from "./workers-oauth-utils";

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Home Assistant MCP Proxy",
		version: "1.0.0",
	});

	async init() {
		// No local tools — all requests are proxied to the upstream HA MCP server
	}

	// Override the fetch handler to proxy all /mcp requests upstream
	async fetch(request: Request): Promise<Response> {
		const upstream = (this.env as any).MCP_UPSTREAM_URL as string;

		if (!upstream) {
			return new Response("MCP_UPSTREAM_URL not configured", { status: 500 });
		}

		const upstreamRequest = new Request(upstream, {
			method: request.method,
			headers: new Headers({
				...Object.fromEntries(request.headers.entries()),
				"CF-Access-Client-Id": (this.env as any).SERVICE_CLIENT_ID as string,
				"CF-Access-Client-Secret": (this.env as any).SERVICE_CLIENT_SECRET as string,
			}),
			body: request.body,
		});

		return fetch(upstreamRequest);
	}
}

export default new OAuthProvider({
	apiHandler: MyMCP.serve("/mcp"),
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: { fetch: handleAccessRequest as any },
	tokenEndpoint: "/token",
});

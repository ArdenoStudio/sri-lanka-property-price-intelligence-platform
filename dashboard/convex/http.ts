import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requireIngestKey(request: Request) {
  const expected = process.env.CONVEX_INGEST_KEY;
  if (!expected) {
    return "CONVEX_INGEST_KEY is not configured";
  }

  const actual = request.headers.get("x-ingest-key");
  if (actual !== expected) {
    return "Invalid ingest key";
  }

  return null;
}

http.route({
  path: "/ingest/raw-listings",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authError = requireIngestKey(request);
    if (authError) {
      return jsonResponse({ error: authError }, authError.includes("configured") ? 503 : 401);
    }

    const body = await request.json();
    if (!body || !Array.isArray(body.listings)) {
      return jsonResponse({ error: "Expected JSON body with listings array" }, 400);
    }

    const result = await ctx.runMutation(internal.ingest.upsertRawListings, {
      listings: body.listings,
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/ingest/listings",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authError = requireIngestKey(request);
    if (authError) {
      return jsonResponse({ error: authError }, authError.includes("configured") ? 503 : 401);
    }

    const body = await request.json();
    if (!body || !Array.isArray(body.listings)) {
      return jsonResponse({ error: "Expected JSON body with listings array" }, 400);
    }

    const result = await ctx.runMutation(internal.ingest.upsertListings, {
      listings: body.listings,
    });
    return jsonResponse(result);
  }),
});

export default http;

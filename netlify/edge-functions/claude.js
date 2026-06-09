// netlify/edge-functions/claude.js
// ───────────────────────────────────────────────────────────────
// Edge Function proxy between the LCare IQ frontend and Anthropic API.
// Runs on Deno at the edge — waiting on the upstream AI response does
// NOT count against the CPU limit, so it bypasses the 10s timeout that
// standard (Lambda) functions hit on the free plan.
// The API key is read from the ANTHROPIC_API_KEY environment variable
// and is NEVER exposed to the browser.
// ───────────────────────────────────────────────────────────────

export default async (request, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  // Env var (Netlify Edge exposes env via Netlify.env / Deno.env)
  let apiKey = "";
  try { apiKey = Netlify.env.get("ANTHROPIC_API_KEY") || ""; } catch (_) {}
  if (!apiKey) { try { apiKey = Deno.env.get("ANTHROPIC_API_KEY") || ""; } catch (_) {} }
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on the server" }), { status: 500, headers });
  }

  let payload;
  try { payload = await request.json(); }
  catch (e) { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers }); }

  // Whitelist + sane defaults — frontend cannot request arbitrary models
  const ALLOWED_MODELS = [
    "claude-sonnet-4-6",
    "claude-opus-4-7",
    "claude-haiku-4-5-20251001"
  ];
  const model = ALLOWED_MODELS.includes(payload.model) ? payload.model : "claude-sonnet-4-6";
  const maxTokens = Math.min(Math.max(parseInt(payload.max_tokens, 10) || 2000, 1), 8000);

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages[] is required" }), { status: 400, headers });
  }

  const body = { model, max_tokens: maxTokens, messages: payload.messages };
  if (payload.system && typeof payload.system === "string") body.system = payload.system;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Upstream request failed", detail: String(err).slice(0, 300) }), { status: 502, headers });
  }
};

export const config = { path: "/api/claude" };

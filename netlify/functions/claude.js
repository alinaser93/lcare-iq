// netlify/functions/claude.js
// ───────────────────────────────────────────────────────────────
// Secure proxy between the LCare IQ frontend and the Anthropic API.
// The API key is read from the ANTHROPIC_API_KEY environment variable
// (set in Netlify dashboard) and NEVER exposed to the browser.
// ───────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // CORS / preflight
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on the server" })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  // Whitelist + sane defaults — frontend cannot request arbitrary models
  const ALLOWED_MODELS = [
    "claude-sonnet-4-6",
    "claude-opus-4-7",
    "claude-haiku-4-5-20251001"
  ];
  const model = ALLOWED_MODELS.includes(payload.model) ? payload.model : "claude-sonnet-4-6";
  const maxTokens = Math.min(Math.max(parseInt(payload.max_tokens, 10) || 2000, 1), 8000);

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "messages[] is required" }) };
  }

  const body = {
    model,
    max_tokens: maxTokens,
    messages: payload.messages
  };
  if (payload.system && typeof payload.system === "string") {
    body.system = payload.system;
  }

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
    return {
      statusCode: upstream.status,
      headers,
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Upstream request failed", detail: String(err).slice(0, 300) })
    };
  }
};

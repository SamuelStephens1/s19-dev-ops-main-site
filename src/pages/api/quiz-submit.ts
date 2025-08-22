// src/pages/api/quiz-submit.ts
import type { APIRoute } from "astro";

type Env = {
  SEND_EMAILS?: string;
  QUIZ_TO_EMAIL?: string;
  QUIZ_FROM_EMAIL?: string;  // e.g. no-reply@s19devops.com
  MC_API_KEY?: string;       // MailChannels HTTP API key
};

interface QuizScores { total: number; pct: number; byPillar?: Record<string, number>; }
interface QuizPayload {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  notes?: string;
  scores?: QuizScores;
  recommendations?: string[];
}

function isQuizPayload(x: unknown): x is QuizPayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const okStr = (k: string) => o[k] === undefined || typeof o[k] === "string";
  const okScores =
    o.scores === undefined ||
    (typeof o.scores === "object" && o.scores !== null &&
      typeof (o.scores as any).total === "number" &&
      typeof (o.scores as any).pct === "number");
  const okRecs =
    o.recommendations === undefined ||
    (Array.isArray(o.recommendations) && o.recommendations.every(v => typeof v === "string"));
  return okStr("name") && okStr("email") && okStr("company") && okStr("phone") && okStr("notes") && okScores && okRecs;
}

/* CORS */
const ALLOWED_ORIGINS = [
  "https://staging.s19-dev-ops-main-site.pages.dev",
  "https://s19-dev-ops-main-site.pages.dev",
  "https://staging.s19devops.com",
  "https://s19devops.com",
  "https://www.s19devops.com",
];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://staging.s19devops.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
});

export const OPTIONS: APIRoute = async ({ request }) =>
  new Response(null, { status: 204, headers: cors(request.headers.get("Origin")) });

export const POST: APIRoute = async (ctx) => {
  const headers = cors(ctx.request.headers.get("Origin"));
  try {
    const env = (ctx.locals.runtime?.env || {}) as Env;

    // JSON only (keep it simple)
    if (!ctx.request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return new Response(JSON.stringify({ ok: false, error: "expected_json" }), {
        status: 400, headers: { ...headers, "content-type": "application/json" }
      });
    }

    const raw = await ctx.request.json().catch(() => ({}));
    if (!isQuizPayload(raw)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), {
        status: 400, headers: { ...headers, "content-type": "application/json" }
      });
    }
    const body = raw as QuizPayload;

    const send = (env.SEND_EMAILS || "").toLowerCase() === "true";
    const to = (env.QUIZ_TO_EMAIL || "").trim();
    const from = (env.QUIZ_FROM_EMAIL || "").trim();        // must be @s19devops.com
    const apiKey = (env.MC_API_KEY || "").trim();

    if (!to || !from) {
      return new Response(JSON.stringify({ ok: false, error: "email_env_not_configured" }), {
        status: 500, headers: { ...headers, "content-type": "application/json" }
      });
    }
    if (!send) {
      // dry-run for staging if SEND_EMAILS=false
      return new Response(JSON.stringify({ ok: true, dev: true }), {
        status: 200, headers: { ...headers, "content-type": "application/json" }
      });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_mc_api_key" }), {
        status: 500, headers: { ...headers, "content-type": "application/json" }
      });
    }

    const subject = `Consulting Readiness Quiz — ${body.company || body.name || "New submission"}`;
    const textLines = [
      `Name: ${body.name || ""}`,
      `Email: ${body.email || ""}`,
      `Company: ${body.company || ""}`,
      `Phone: ${body.phone || ""}`,
      "",
      `Scores: ${JSON.stringify(body.scores ?? {}, null, 2)}`,
      "",
      "Recommendations:",
      ...((body.recommendations ?? []).map(r => `- ${r}`)),
      "",
      `Notes: ${body.notes || ""}`,
    ];
    const text = textLines.join("\n");

    // *** MINIMAL MailChannels HTTP API payload ***
    const mc = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: "Signal DevOps" },
      subject,
      content: [{ type: "text/plain", value: text }]
    };

    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Api-Key": apiKey
      },
      body: JSON.stringify(mc),
    });

    const bodyText = await resp.text(); // get any error details
    if (!resp.ok) {
      // Surface what MC returned so we can see the exact reason
      return new Response(JSON.stringify({ ok: false, error: "mailchannels", status: resp.status, body: bodyText }), {
        status: 400, headers: { ...headers, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...headers, "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: "server_error", message: String(e?.message ?? e) }), {
      status: 500, headers: { ...headers, "content-type": "application/json" }
    });
  }
};

import type { APIRoute } from "astro";

type Env = {
  SEND_EMAILS?: string;
  QUIZ_TO_EMAIL?: string;
  QUIZ_FROM_EMAIL?: string;
};

interface QuizScores {
  total: number;
  pct: number;
  byPillar?: Record<string, number>;
}
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
  const okArrStr =
    o.recommendations === undefined ||
    (Array.isArray(o.recommendations) && o.recommendations.every((v) => typeof v === "string"));
  const okScores =
    o.scores === undefined ||
    (typeof o.scores === "object" &&
      o.scores !== null &&
      typeof (o.scores as any).pct === "number" &&
      typeof (o.scores as any).total === "number");
  return okStr("name") && okStr("email") && okStr("company") && okStr("phone") && okStr("notes") && okArrStr && okScores;
}

export const POST: APIRoute = async (ctx) => {
  try {
    const env = (ctx.locals.runtime?.env || {}) as Env;

    if (!ctx.request.headers.get("content-type")?.includes("application/json")) {
      return new Response(JSON.stringify({ ok: false, error: "Expected application/json" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const raw = (await ctx.request.json()) as unknown;
    if (!isQuizPayload(raw)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid payload" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const body = raw as QuizPayload;

    const subject = `Consulting Readiness Quiz — ${body.company || body.name || "New submission"}`;
    const text = [
      `Name: ${body.name || ""}`,
      `Email: ${body.email || ""}`,
      `Company: ${body.company || ""}`,
      `Phone: ${body.phone || ""}`,
      "",
      `Scores: ${JSON.stringify(body.scores ?? {}, null, 2)}`,
      "",
      "Recommendations:",
      ...((body.recommendations ?? []).map((r) => `- ${r}`)),
      "",
      `Notes: ${body.notes || ""}`,
      "",
      "Source: Resources → Consulting Readiness Quiz",
    ].join("\n");

    const sendEmails = (env.SEND_EMAILS || "").toLowerCase() === "true";
    const to = (env.QUIZ_TO_EMAIL || "").trim();
    const from = (env.QUIZ_FROM_EMAIL || "").trim();

    if (!sendEmails) {
      console.log("[QUIZ][DEV] Not sending (SEND_EMAILS=false)", { to, from, body });
      return new Response(JSON.stringify({ ok: true, dev: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (!to || !from) {
      console.error("[QUIZ] Missing env", { toPresent: !!to, fromPresent: !!from });
      return new Response(JSON.stringify({ ok: false, error: "Email env not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const mcPayload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: "Signal DevOps" },
      reply_to: body.email ? { email: body.email, name: body.name || body.email } : undefined,
      subject,
      content: [{ type: "text/plain", value: text }],
    };

    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mcPayload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[QUIZ] MailChannels error:", resp.status, errText);
      return new Response(JSON.stringify({ ok: false, error: "MailChannels error", status: resp.status }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[QUIZ] Unhandled error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: false, error: "Use POST" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });

import type { APIRoute } from "astro";

const isProd = import.meta.env.MODE === "production";

// ----- Types -----
interface QuizScores {
  total: number;
  pct: number;
  byPillar: Record<string, number>;
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

// Very light runtime guard to avoid crashing on bad input
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

// ----- Handler -----
export const POST: APIRoute = async ({ request }) => {
  try {
    // 1) Parse JSON safely
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return new Response(JSON.stringify({ ok: false, error: "Expected application/json" }), { status: 400 });
    }

    const raw = (await request.json()) as unknown;
    if (!isQuizPayload(raw)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid payload" }), { status: 400 });
    }
    const body: QuizPayload = raw;

    // 2) Build email text (works for dev + prod)
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

    // 3) In development: don't send; log and return success so the UI is happy
    if (!isProd) {
      console.log("[DEV] Quiz submission (email not sent):\nSubject:", subject, "\n\n" + text);
      return new Response(JSON.stringify({ ok: true, dev: true }), { status: 200 });
    }

    // 4) Production: send via MailChannels
    const to = (import.meta.env.QUIZ_TO_EMAIL || "").trim();
    const from = (import.meta.env.QUIZ_FROM_EMAIL || "").trim();
    if (!to || !from) {
      console.error("QUIZ_* env missing", { to, fromPresent: Boolean(from) });
      return new Response(JSON.stringify({ ok: false, error: "Email env not configured" }), { status: 500 });
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
      console.error("MailChannels error:", resp.status, errText);
      return new Response(JSON.stringify({ ok: false, error: "MailChannels error", status: resp.status }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: unknown) {
    console.error("quiz-submit error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Unhandled server error" }), { status: 500 });
  }
};

// Optional: respond 405 for non-POST
export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: false, error: "Use POST" }), { status: 405 });

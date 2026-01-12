import type { APIRoute } from "astro";

type Env = {
  SEND_EMAILS?: string;
  QUIZ_TO_EMAIL?: string;
  QUIZ_FROM_EMAIL?: string;
  RESEND_API_KEY?: string;
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
  answers?: Record<string, number>;
}

function isQuizPayload(x: unknown): x is QuizPayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.email === "string" &&
    typeof o.scores === "object" &&
    typeof o.recommendations === "object"
  );
}

const QUESTIONS: Record<string, { pillar: string; text: string }> = {
  s1: { pillar: "Strategy", text: "We have a clear 12–18 month technology roadmap tied to business goals." },
  s2: { pillar: "Strategy", text: "Leaders use data/analytics regularly to make decisions." },
  o1: { pillar: "Operations", text: "Key processes (sales ops, support, fulfillment) are documented and measured." },
  o2: { pillar: "Operations", text: "We automate repetitive manual tasks where possible." },
  d1: { pillar: "Data", text: "Our customer and revenue data is centralized and reasonably clean." },
  d2: { pillar: "Data", text: "We can track a lead/opportunity from first touch to closed revenue." },
  sec1: { pillar: "Security", text: "We enforce MFA, device policies, and basic Zero Trust controls." },
  sec2: { pillar: "Security", text: "We log security events and review alerts weekly." },
  c1: { pillar: "Culture", text: "Teams are trained to use AI and automation responsibly." },
  c2: { pillar: "Culture", text: "We run pilots/experiments and measure ROI before scaling." },
};

function formatAnswers(answers: Record<string, number>): string {
  const grouped: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(answers)) {
    const q = QUESTIONS[key];
    if (!q) continue;
    if (!grouped[q.pillar]) grouped[q.pillar] = [];
    grouped[q.pillar].push(`- ${q.text} — ${val}`);
  }

  return Object.entries(grouped)
    .map(([pillar, qs]) => `• ${pillar}:\n${qs.join("\n")}`)
    .join("\n\n");
}

function formatResultsEmail(body: QuizPayload): string {
  const { name, email, company, phone, notes, scores, recommendations, answers } = body;

  const answersBlock =
    answers && Object.keys(answers).length
      ? `\nAnswers:\n${formatAnswers(answers)}\n`
      : "";

  return `Hi ${name || "there"},

Thanks for completing the Consulting Readiness Quiz. Here's a copy of your responses:

Name: ${name}
Email: ${email}
Company: ${company || ""}
Phone: ${phone || ""}

Scores:
- Total: ${scores?.total ?? "?"} / 50
- Readiness: ${scores?.pct ?? "?"}%
- By Pillar:
  • Strategy: ${scores?.byPillar?.Strategy ?? 0}
  • Operations: ${scores?.byPillar?.Operations ?? 0}
  • Data: ${scores?.byPillar?.Data ?? 0}
  • Security: ${scores?.byPillar?.Security ?? 0}
  • Culture: ${scores?.byPillar?.Culture ?? 0}

Recommendations:
${(recommendations || []).map((r) => `- ${r}`).join("\n")}
${answersBlock}
${notes ? `Additional Notes:\n${notes}` : ""}
`;
}

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
  const headers = {
    ...cors(ctx.request.headers.get("Origin")),
    "Content-Type": "application/json",
  };

  try {
    const env = (ctx.locals.runtime?.env || {}) as Env;

    const sendEmails = (env.SEND_EMAILS || "").toLowerCase() === "true";
    const to = (env.QUIZ_TO_EMAIL || "").trim();
    const from = (env.QUIZ_FROM_EMAIL || "").trim();
    const resendKey = (env.RESEND_API_KEY || "").trim();

    // Validate JSON payload
    const contentType = ctx.request.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ ok: false, error: "expected_json" }), {
        status: 400,
        headers,
      });
    }

    const body = await ctx.request.json().catch(() => null);
    if (!isQuizPayload(body)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), {
        status: 400,
        headers,
      });
    }

    // Basic email env check
    if (!to || !from) {
      return new Response(JSON.stringify({ ok: false, error: "email_env_not_configured" }), {
        status: 500,
        headers,
      });
    }

    // Render content
    const text = formatResultsEmail(body);
    const subject = `Consulting Readiness Quiz — ${body.company || body.name || "New submission"}`;

    if (!sendEmails) {
      console.log("[dev] Skipping email send. Message body:\n", text);
      return new Response(JSON.stringify({ ok: true, dev: true }), {
        status: 200,
        headers,
      });
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_resend_key" }), {
        status: 500,
        headers,
      });
    }

    const resendHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    };

    // === Send to internal team ===
    const internalRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders,
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
        reply_to: body.email || undefined,
      }),
    });

    if (!internalRes.ok) {
      const bodyText = await internalRes.text();
      return new Response(
        JSON.stringify({
          ok: false,
          error: "resend_error",
          status: internalRes.status,
          body: bodyText,
        }),
        {
          status: 400,
          headers,
        }
      );
    }

    // === Send copy to user ===
    if (body.email) {
      const userRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: resendHeaders,
        body: JSON.stringify({
          from,
          to: body.email,
          subject: "Your Consulting Readiness Quiz Submission",
          text,
        }),
      });

      if (!userRes.ok) {
        // Don't fail the entire request if internal succeeded; log for debugging
        const bodyText = await userRes.text().catch(() => "");
        console.log("[warn] Failed sending user copy:", userRes.status, bodyText);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "server_error",
        message: String(e?.message ?? e),
      }),
      {
        status: 500,
        headers,
      }
    );
  }
};

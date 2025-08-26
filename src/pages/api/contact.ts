import type { APIRoute } from "astro";

type Env = {
  SEND_EMAILS?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
};

const ALLOWED_ORIGINS = [
  "https://staging.s19devops.com",
  "https://s19devops.com",
  "https://www.s19devops.com",
  "https://staging.s19-dev-ops-main-site.pages.dev",
  "https://s19-dev-ops-main-site.pages.dev",
];

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin":
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
  "Content-Type": "application/json",
});

export const OPTIONS: APIRoute = async ({ request }) =>
  new Response(null, { status: 204, headers: cors(request.headers.get("Origin")) });

export const POST: APIRoute = async (ctx) => {
  const hdrs = cors(ctx.request.headers.get("Origin"));
  const env = (ctx.locals.runtime?.env || {}) as Env;

  try {
    const contentType = ctx.request.headers.get("content-type") || "";
    let name = "Anonymous", email = "", message = "";

    if (contentType.includes("application/json")) {
      const body = await ctx.request.json() as { name?: string; email?: string; message?: string };
      name = body.name?.trim() || "Anonymous";
      email = body.email?.trim() || "";
      message = body.message?.trim() || "";
    } else if (
      contentType.includes("form-data") ||
      contentType.includes("x-www-form-urlencoded")
    ) {
      const form = await ctx.request.formData();
      name = form.get("name")?.toString().trim() || "Anonymous";
      email = form.get("email")?.toString().trim() || "";
      message = form.get("message")?.toString().trim() || "";
    } else {
      return new Response(JSON.stringify({ ok: false, error: "unsupported_content_type" }), {
        status: 415,
        headers: hdrs,
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ ok: false, error: "empty_message" }), {
        status: 400,
        headers: hdrs,
      });
    }

    const to = env.CONTACT_TO_EMAIL?.trim() || "";
    const from = env.CONTACT_FROM_EMAIL?.trim() || "";
    const send = env.SEND_EMAILS?.toLowerCase() === "true";

    if (!to || !from) {
      return new Response(JSON.stringify({ ok: false, error: "email_env_not_configured" }), {
        status: 500,
        headers: hdrs,
      });
    }

    const subject = `New Contact Form Submission from ${name}`;
    const text = `Name: ${name}\nEmail: ${email || "(not provided)"}\n\nMessage:\n${message}`;

    if (!send) {
      console.log("[dev] Skipping email send:");
      console.log(text);
      return new Response(JSON.stringify({ ok: true, dev: true }), {
        status: 200,
        headers: hdrs,
      });
    }

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer re_TQusYxKA_4VBcYeuX4TEcQGjETJVVK8Vc", // Consider moving this to env
      },
      body: JSON.stringify({ from, to, subject, text }),
    });

    const emailRespText = await emailResp.text();

    if (!emailResp.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: "resend_error",
        status: emailResp.status,
        body: emailRespText,
      }), {
        status: emailResp.status,
        headers: hdrs,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: hdrs,
    });

  } catch (e: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: "server_error",
      message: String(e?.message ?? e),
    }), {
      status: 500,
      headers: hdrs,
    });
  }
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: false, error: "Use POST" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });

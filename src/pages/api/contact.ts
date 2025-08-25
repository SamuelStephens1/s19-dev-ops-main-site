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
});

export const OPTIONS: APIRoute = async ({ request }) =>
  new Response(null, { status: 204, headers: cors(request.headers.get("Origin")) });

export const POST: APIRoute = async (ctx) => {
  const hdrs = cors(ctx.request.headers.get("Origin"));
  try {
    const env = (ctx.locals.runtime?.env || {}) as Env;

    let name = "Anonymous", email = "", message = "";

    const contentType = ctx.request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const b = await ctx.request.json() as { name?: string; email?: string; message?: string };
    }else if (contentType.includes("form-data") || contentType.includes("x-www-form-urlencoded")) {
      const form = await ctx.request.formData();
      name = form.get("name")?.toString() || "Anonymous";
      email = form.get("email")?.toString() || "";
      message = form.get("message")?.toString() || "";
    } else {
      return new Response(JSON.stringify({ ok: false, error: "unsupported_content_type" }), {
        status: 415, headers: { ...hdrs, "content-type": "application/json" },
      });
    }

    const to = env.CONTACT_TO_EMAIL?.trim() || "";
    const from = env.CONTACT_FROM_EMAIL?.trim() || "";
    const send = env.SEND_EMAILS?.toLowerCase() === "true";

    if (!to || !from) {
      return new Response(JSON.stringify({ ok: false, error: "email_env_not_configured" }), {
        status: 500, headers: { ...hdrs, "content-type": "application/json" },
      });
    }
    if (!message.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "empty_message" }), {
        status: 400, headers: { ...hdrs, "content-type": "application/json" },
      });
    }

    const subject = `New Contact Form Submission from ${name}`;
    const text = `Name: ${name}\nEmail: ${email || "(not provided)"}\n\nMessage:\n${message}`;

    if (!send) {
      return new Response(JSON.stringify({ ok: true, dev: true }), {
        status: 200, headers: { ...hdrs, "content-type": "application/json" },
      });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer re_TQusYxKA_4VBcYeuX4TEcQGjETJVVK8Vc",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
      }),
    });

    const respText = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: "resend", status: resp.status, body: respText }), {
        status: resp.status, headers: { ...hdrs, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...hdrs, "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: "server_error", message: String(e?.message ?? e) }), {
      status: 500, headers: { ...hdrs, "content-type": "application/json" },
    });
  }
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: false, error: "Use POST" }), {
    status: 405, headers: { "content-type": "application/json" },
  });

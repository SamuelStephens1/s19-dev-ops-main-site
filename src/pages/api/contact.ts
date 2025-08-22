// src/pages/api/contact.ts
import type { APIRoute } from "astro";

type Env = {
  SEND_EMAILS?: string;
  CONTACT_TO_EMAIL?: string;    // your inbox
  CONTACT_FROM_EMAIL?: string;  // must be @s19devops.com
  MC_API_KEY?: string;          // MailChannels HTTP API key (Secret)
};

/* CORS (allow your origins) */
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

    // Parse JSON or form-data
    const ct = (ctx.request.headers.get("content-type") || "").toLowerCase();
    let name = "Anonymous", email = "", message = "";
    if (!ct || ct.startsWith("application/json")) {
      const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
      if (typeof b.name === "string") name = b.name;
      if (typeof b.email === "string") email = b.email;
      if (typeof b.message === "string") message = b.message;
    } else if (ct.startsWith("multipart/form-data") || ct.startsWith("application/x-www-form-urlencoded")) {
      const f = await ctx.request.formData();
      name = (f.get("name")?.toString() || "Anonymous");
      email = (f.get("email")?.toString() || "");
      message = (f.get("message")?.toString() || "");
    } else {
      return new Response(JSON.stringify({ ok:false, error:"unsupported_content_type" }), {
        status: 415, headers: { ...hdrs, "content-type":"application/json" }
      });
    }

    const to = (env.CONTACT_TO_EMAIL || "").trim();
    const from = (env.CONTACT_FROM_EMAIL || "").trim();
    const send = (env.SEND_EMAILS || "").toLowerCase() === "true";
    const apiKey = (env.MC_API_KEY || "").trim();

    if (!to || !from) {
      return new Response(JSON.stringify({ ok:false, error:"email_env_not_configured" }), {
        status: 500, headers: { ...hdrs, "content-type":"application/json" }
      });
    }
    if (!message.trim()) {
      return new Response(JSON.stringify({ ok:false, error:"empty_message" }), {
        status: 400, headers: { ...hdrs, "content-type":"application/json" }
      });
    }

    const subject = `New Contact Form Submission from ${name}`;
    const text = `Name: ${name}\nEmail: ${email || "(not provided)"}\n\nMessage:\n${message}`;

    if (!send) {
      return new Response(JSON.stringify({ ok:true, dev:true }), {
        status: 200, headers: { ...hdrs, "content-type":"application/json" }
      });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ ok:false, error:"missing_mc_api_key" }), {
        status: 500, headers: { ...hdrs, "content-type":"application/json" }
      });
    }

    // MailChannels payload (exact minimal shape you provided)
    const mcPayload = {
      personalizations: [
        { to: [{ email: to }] }
      ],
      from: { email: from, name: "Signal DevOps Website" },
      subject,
      content: [{ type: "text/plain", value: text }]
    };

    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Api-Key": apiKey
      },
      body: JSON.stringify(mcPayload)
    });

    const respBody = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok:false, error:"mailchannels", status: resp.status, body: respBody }), {
        status: resp.status, headers: { ...hdrs, "content-type":"application/json" }
      });
    }

    return new Response(JSON.stringify({ ok:true }), {
      status: 200, headers: { ...hdrs, "content-type":"application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error:"server_error", message:String(e?.message ?? e) }), {
      status: 500, headers: { ...hdrs, "content-type":"application/json" }
    });
  }
};

// (optional)
export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok:false, error:"Use POST" }), {
    status: 405, headers: { "content-type":"application/json" }
  });

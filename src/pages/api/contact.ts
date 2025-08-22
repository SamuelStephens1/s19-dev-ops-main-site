import type { APIRoute } from "astro";

type Env = {
  SEND_EMAILS?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
};

export const POST: APIRoute = async (ctx) => {
  try {
    const env = (ctx.locals.runtime?.env || {}) as Env;

    // read form
    const form = await ctx.request.formData();
    const name = (form.get("name") || "Anonymous").toString();
    const email = (form.get("email") || "").toString();
    const message = (form.get("message") || "").toString();

    // env + short-circuit for staging
    const sendEmails = (env.SEND_EMAILS || "").toLowerCase() === "true";
    const to = (env.CONTACT_TO_EMAIL || "").trim();
    const from = (env.CONTACT_FROM_EMAIL || "").trim();

    const subject = `New Contact Form Submission from ${name}`;
    const text = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

    if (!sendEmails) {
      console.log("[CONTACT][DEV] Not sending (SEND_EMAILS=false)", { to, from, name, email, message });
      return new Response(JSON.stringify({ ok: true, dev: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (!to || !from) {
      console.error("[CONTACT] Missing env", { toPresent: !!to, fromPresent: !!from });
      return new Response(JSON.stringify({ ok: false, error: "Email env not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const mcPayload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: "Signal DevOps Website" },
      reply_to: email ? { email, name: name || email } : undefined,
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
      console.error("[CONTACT] MailChannels error:", resp.status, errText);
      return new Response(JSON.stringify({ ok: false, error: "MailChannels error" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[CONTACT] Unhandled error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

// Optional: reject non-POST
export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: false, error: "Use POST" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });

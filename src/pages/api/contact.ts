import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString() || "Anonymous";
    const email = formData.get("email")?.toString() || "No email";
    const message = formData.get("message")?.toString() || "No message";

    const subject = `New Contact Form Submission from ${name}`;
    const text = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

    const to = "s19devops@outlook.com";
    const from = "no-reply@signaldevops.com";

    const mcPayload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: "Signal DevOps Website" },
      reply_to: { email, name },
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
      return new Response("Error sending email", { status: 500 });
    }

    return new Response("Success", { status: 200 });
  } catch (e) {
    console.error("Contact form error:", e);
    return new Response("Server error", { status: 500 });
  }
};

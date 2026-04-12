const RESEND_API_URL = "https://api.resend.com/emails";

export function normalizeBaseUrl(value?: string | null) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function buildInviteLink(baseUrl: string, slug: string, token: string) {
  return `${baseUrl}/f/${slug}?invite=${encodeURIComponent(token)}`;
}

export function buildInviteEmail(args: {
  formTitle: string;
  formDescription?: string;
  inviteUrl: string;
}) {
  const { formTitle, formDescription, inviteUrl } = args;
  const previewText = `You've been invited to complete "${formTitle}" on Sayso.`;

  return {
    subject: `You're invited to complete "${formTitle}"`,
    text: [
      previewText,
      "",
      formDescription?.trim() || "Open the link below to answer by voice.",
      "",
      inviteUrl,
      "",
      "No login is required.",
    ].join("\n"),
    html: `
      <div style="margin:0;background:#f7f3eb;padding:32px 16px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#171717;">
        <div style="margin:0 auto;max-width:560px;border:1px solid rgba(0,0,0,0.08);background:#ffffff;padding:40px 32px;">
          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#78716c;">Sayso invite</div>
          <h1 style="margin:18px 0 12px;font-size:34px;line-height:1.05;font-weight:600;font-family:Georgia,serif;color:#111827;">${escapeHtml(formTitle)}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#44403c;">${escapeHtml(
            formDescription?.trim() || "You've been invited to complete a short voice form.",
          )}</p>
          <a href="${inviteUrl}" style="display:inline-block;border-radius:999px;background:#111827;padding:14px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open voice form</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#78716c;">No login required. Just tap the button and answer by voice.</p>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;word-break:break-all;">${inviteUrl}</p>
        </div>
      </div>
    `,
  };
}

export async function sendInviteEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || response.statusText || "Failed to send email",
    );
  }

  if (!payload?.id) {
    throw new Error("Resend did not return a message id");
  }

  return { id: payload.id };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

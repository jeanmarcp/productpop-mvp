// lib/email-templates.ts
// Email template registry. Copy lives in a single place so the CMO can
// edit it without touching code. Each template exposes:
//   - id: stable identifier (also used in API paths)
//   - subject: the rendered subject line (function so we can interpolate)
//   - render(vars): returns { subject, html, text } for a given set of vars
//
// When real send happens, the marketing email worker will call
// /api/email/<id> with a JSON body of vars and POST to the upstream
// provider (Resend, Postmark, etc.) with the returned payload.

export type EmailVars = Record<string, string | number | boolean | null | undefined>;

export interface EmailTemplate {
  id: string;
  description: string;
  subject: (vars: EmailVars) => string;
  html: (vars: EmailVars) => string;
  text: (vars: EmailVars) => string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseLayout(previewText: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{{subject}}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <span style="display:none;visibility:hidden;mso-hide:all">${escapeHtml(previewText)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0b0b;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#161616;border-radius:12px;padding:32px;">
            <tr><td>${bodyHtml}</td></tr>
          </table>
          <p style="color:#666;font-size:12px;margin-top:16px;">
            ProductPop · You are receiving this because you signed up at productpop.ai.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const templates: Record<string, EmailTemplate> = {
  "referral-intro": {
    id: "referral-intro",
    description:
      "Sent right after a user joins the waitlist. Introduces the referral program and includes their unique invite link.",
    subject: (vars) => {
      const name = (vars.firstName as string) || "there";
      return `Your ProductPop invite link is ready, ${name}`;
    },
    html: (vars) => {
      const name = escapeHtml((vars.firstName as string) || "there");
      const link = escapeHtml((vars.referralLink as string) || "");
      const code = escapeHtml((vars.referralCode as string) || "");
      const body = `
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#fff;">Welcome to ProductPop, ${name}!</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cfcfcf;">
          Thanks for joining the waitlist. ProductPop turns one product photo into
          a clean, marketplace-ready image in seconds — and we want you to help us
          shape the launch.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cfcfcf;">
          Your invite link is below. Share it with sellers, makers, or friends
          who list stuff online — every signup moves you up the queue and unlocks
          bonus credits when we ship.
        </p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${link}" style="display:inline-block;background:#f5f5f5;color:#0b0b0b;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;font-size:15px;">
            Share ${code}
          </a>
        </p>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#888;">
          Or copy your link: <span style="color:#cfcfcf;">${link}</span>
        </p>
        <!-- CMO: replace the paragraphs above with launch copy. Vars available: firstName, referralCode, referralLink, queuePosition. -->
      `;
      return baseLayout("Your ProductPop invite link is ready", body);
    },
    text: (vars) => {
      const name = (vars.firstName as string) || "there";
      const link = (vars.referralLink as string) || "";
      const code = (vars.referralCode as string) || "";
      return [
        `Welcome to ProductPop, ${name}!`,
        "",
        "Thanks for joining the waitlist. ProductPop turns one product photo",
        "into a clean, marketplace-ready image in seconds.",
        "",
        "Your invite link is ready. Share it with sellers, makers, or friends",
        "who list stuff online — every signup moves you up the queue.",
        "",
        `Your code: ${code}`,
        `Your link: ${link}`,
        "",
        "— The ProductPop team",
      ].join("\n");
    },
  },
};

export function listTemplateIds(): string[] {
  return Object.keys(templates);
}

export function renderTemplate(
  id: string,
  vars: EmailVars
): { subject: string; html: string; text: string } | null {
  const t = templates[id];
  if (!t) return null;
  return {
    subject: t.subject(vars),
    html: t.html(vars),
    text: t.text(vars),
  };
}

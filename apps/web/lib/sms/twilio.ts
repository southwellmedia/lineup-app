import { createHmac, timingSafeEqual } from "node:crypto";

export type SmsConfig = {
  accountSid: string;
  authToken: string;
  /** A Twilio number (+1...) or a Messaging Service SID (MG...). */
  from: string;
};

/** Twilio settings from the environment, or null if texts aren't set up yet. */
export function smsConfig(env: Record<string, string | undefined> = process.env): SmsConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const from = env.TWILIO_FROM?.trim();
  return accountSid && authToken && from ? { accountSid, authToken, from } : null;
}

export type SendResult =
  { status: "sent"; providerId: string } | { status: "failed"; error: string };

/** Sends one text through Twilio's REST API. */
export async function sendSms(config: SmsConfig, to: string, body: string): Promise<SendResult> {
  const form = new URLSearchParams({ To: to, Body: body });
  form.set(config.from.startsWith("MG") ? "MessagingServiceSid" : "From", config.from);
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(10_000),
      },
    );
    const json = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!response.ok || !json.sid) {
      return {
        status: "failed",
        error: (json.message ?? `Twilio ${response.status}`).slice(0, 500),
      };
    }
    return { status: "sent", providerId: json.sid };
  } catch (error) {
    return { status: "failed", error: String(error).slice(0, 500) };
  }
}

/**
 * Twilio's webhook signature: HMAC-SHA1 over the full URL followed by every
 * POST parameter (sorted by name) as name+value, base64-encoded.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function validTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** A TwiML reply (or an empty response when there's nothing to say). */
export function twiml(message?: string): string {
  const escape = (text: string) =>
    text.replace(
      /[<>&'"]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
    );
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${escape(message)}</Message>` : ""}</Response>`;
}

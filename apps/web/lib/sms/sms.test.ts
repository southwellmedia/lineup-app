import { describe, expect, it } from "vitest";
import { reminderDue } from "./reminders";
import { confirmationText, parseReply, reminderText, type BookingFacts } from "./templates";
import { smsConfig, twiml, twilioSignature, validTwilioSignature } from "./twilio";

const facts: BookingFacts = {
  shopName: "Southside Cuts",
  clientName: "Jordan Ellis",
  services: ["Fade", "Beard Trim"],
  barberName: "Andrea",
  startsAt: "2026-09-25T19:30:00Z",
  timezone: "America/Chicago",
  address: "123 W Davis St, Dallas",
  shopPhone: "+12145550199",
};

describe("texts", () => {
  it("confirms with the shop, service, barber and local time", () => {
    expect(confirmationText(facts)).toBe(
      "Southside Cuts: you're booked, Jordan. Fade + Beard Trim with Andrea, Fri Sep 25 at 2:30 PM.\n123 W Davis St, Dallas\nReply C to confirm or X to cancel. Reply STOP to opt out.",
    );
  });
  it("reminds a day and two hours ahead", () => {
    expect(reminderText("reminder_24h", facts)).toContain("see you tomorrow at 2:30 PM");
    expect(reminderText("reminder_2h", facts)).toBe(
      "Southside Cuts: see you at 2:30 PM, Jordan. 123 W Davis St, Dallas",
    );
  });
});

describe("parseReply", () => {
  it("reads confirmations, cancellations and opt-outs", () => {
    expect(parseReply(" C ")).toBe("confirm");
    expect(parseReply("Yes!")).toBe("confirm");
    expect(parseReply("x")).toBe("cancel");
    expect(parseReply("Cancel")).toBe("cancel");
    expect(parseReply("STOP")).toBe("stop");
    expect(parseReply("start")).toBe("start");
    expect(parseReply("running 5 late")).toBe("other");
  });
});

describe("reminderDue", () => {
  const start = "2026-09-26T19:00:00Z";
  const at = (iso: string) => new Date(iso);
  it("sends the 24h reminder inside the last day, for bookings made well ahead", () => {
    const early = { startsAt: start, createdAt: "2026-09-20T12:00:00Z" };
    expect(reminderDue("reminder_24h", early, at("2026-09-25T18:00:00Z"))).toBe(false); // 25h out
    expect(reminderDue("reminder_24h", early, at("2026-09-25T19:10:00Z"))).toBe(true);
    expect(reminderDue("reminder_24h", early, at("2026-09-26T17:00:00Z"))).toBe(false); // 2h out
    const late = { startsAt: start, createdAt: "2026-09-26T01:00:00Z" }; // booked 18h ahead
    expect(reminderDue("reminder_24h", late, at("2026-09-26T06:00:00Z"))).toBe(false);
  });
  it("sends the 2h reminder before the start, unless they only just booked", () => {
    const booking = { startsAt: start, createdAt: "2026-09-26T09:00:00Z" };
    expect(reminderDue("reminder_2h", booking, at("2026-09-26T17:30:00Z"))).toBe(true);
    expect(reminderDue("reminder_2h", booking, at("2026-09-26T19:05:00Z"))).toBe(false);
    const lastMinute = { startsAt: start, createdAt: "2026-09-26T17:30:00Z" };
    expect(reminderDue("reminder_2h", lastMinute, at("2026-09-26T17:45:00Z"))).toBe(false);
  });
});

describe("twilio", () => {
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = {
    CallSid: "CA1234567890ABCDE",
    Caller: "+12349013030",
    Digits: "1234",
    From: "+12349013030",
    To: "+18005551212",
  };
  it("matches Twilio's own signature for the documented example", () => {
    expect(twilioSignature("12345", url, params)).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
    expect(validTwilioSignature("12345", url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(true);
  });
  it("rejects tampered or missing signatures", () => {
    expect(
      validTwilioSignature(
        "12345",
        url,
        { ...params, Digits: "9" },
        "0/KCTR6DLpKmkAf8muzZqo1nDgQ=",
      ),
    ).toBe(false);
    expect(validTwilioSignature("12345", url, params, null)).toBe(false);
  });
  it("reads config only when complete", () => {
    expect(smsConfig({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t" })).toBeNull();
    expect(
      smsConfig({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+1214" }),
    ).toEqual({
      accountSid: "AC1",
      authToken: "t",
      from: "+1214",
    });
  });
  it("escapes TwiML", () => {
    expect(twiml("Fade & <beard>")).toContain("<Message>Fade &amp; &lt;beard&gt;</Message>");
    expect(twiml()).toContain("<Response></Response>");
  });
});

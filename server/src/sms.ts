import type { Bindings } from "./context";

// shortcut: no SMS provider chosen yet (the PRD lists Razorpay as the only external API, but OTP needs one).
// Dev logs the message; production refuses so OTPs never silently go nowhere.
export async function sendSms(env: Bindings, phone: string, text: string) {
  if (env.ENVIRONMENT === "production") throw new Error("SMS provider not configured");
  console.log(`[sms] ${phone}: ${text}`);
}

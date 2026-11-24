import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import gu from "@/messages/gu.json";
import hi from "@/messages/hi.json";

export const MESSAGES = { en, hi, gu };
export type Lang = keyof typeof MESSAGES;

export const tr = (lang: string) =>
  createTranslator({ locale: lang, messages: MESSAGES[lang as Lang] ?? en });

export const inr = (paise: number, lang: string) =>
  new Intl.NumberFormat(locale(lang), {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);

/** Each language's own name, the same whatever the UI language is. */
export const langName = (lang: string | null) =>
  ({ en: "English", hi: "हिन्दी", gu: "ગુજરાતી" })[lang as Lang] ?? lang ?? "";

/** Intl locale for dates and money: Indian conventions in the report's own language. */
export const locale = (lang: string) => (lang in MESSAGES ? `${lang}-IN` : "en-IN");

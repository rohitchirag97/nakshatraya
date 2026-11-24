import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Gujarati, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Self-hosted at build time; Chromium shapes Indic conjuncts correctly with these (PRD: Indic rendering).
const latin = Noto_Sans({ subsets: ["latin"], variable: "--font-latin", display: "block" });
const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  variable: "--font-deva",
  display: "block",
});
const gujr = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  weight: ["400", "600", "700"],
  variable: "--font-gujr",
  display: "block",
});

// Headings: Poppins covers Latin and Devanagari; Gujarati headings fall back to Noto above.
const head = Poppins({
  subsets: ["latin", "devanagari"],
  weight: ["500", "600", "700"],
  variable: "--font-head",
  display: "block",
});

export const metadata: Metadata = { title: "Kundli" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${latin.variable} ${deva.variable} ${gujr.variable} ${head.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

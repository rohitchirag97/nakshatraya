import type { Chart, Section } from "@jyotish/engine";

// Shape of GET /api/reports/:id (server/src/reports.ts).
export interface ReportView {
  id: string;
  lang: "en" | "hi" | "gu";
  status: "ready" | "locked";
  createdAt: string;
  tenant: {
    slug: string;
    name: string;
    logoUrl: string | null;
    brandColor: string;
    chartStyle: "north" | "south";
    footerText: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  profile: {
    name: string;
    gender: "male" | "female" | "other";
    birthLocal: string; // "1990-01-01 10:00:00", wall clock
    timeKnown: boolean;
    tz: string;
    lat: number;
    lon: number;
    place: { name: string; admin1: string | null; country: string } | null;
  };
  chart: Chart;
  sections: Section[];
}

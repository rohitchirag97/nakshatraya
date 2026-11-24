import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NorthChart } from "@/components/charts";
import { Bolt, Chart, Clock, Globe, Scroll, Shield, Sparkle } from "@/components/Icons";
import { PLATFORM_NAME, PlatformHome, platformIcons } from "@/components/Platform";
import { getMe, Shell } from "@/components/Shell";
import { Wheel } from "@/components/Wheel";
import { apiJson, type PublicTenant } from "@/lib/api";
import { inr, tr } from "@/lib/i18n";

// A sample chart for the hero (illustrative placements, labelled as a sample).
const SAMPLE = [
  ["Sun", 4], ["Moon", 0], ["Mars", 5], ["Mercury", 3], ["Jupiter", 4], ["Venus", 4],
  ["Saturn", 9], ["Rahu", 8], ["Ketu", 2],
] as const; // biome-ignore format: table

// The platform's own site gets our name and icon; tenant sites keep the default (white-label).
export async function generateMetadata(): Promise<Metadata> {
  const { status } = await apiJson<PublicTenant>("/api/tenant");
  return status === 404
    ? {
        title: `${PLATFORM_NAME}: sell kundli reports under your own brand`,
        icons: platformIcons,
      }
    : {};
}

export default async function Home() {
  const { status, data: tenant } = await apiJson<PublicTenant>("/api/tenant");
  // No tenant on this host: it's the platform's own website (partner landing + apply form).
  if (status === 404) return <PlatformHome />;
  if (status !== 200) notFound();
  const me = await getMe();
  const lang = tenant.defaultLang;
  const t = tr(lang);
  const start = me ? "/app" : "/login";
  const price = tenant.kundliPricePaise
    ? t("home.prices", {
        pdf: inr(tenant.kundliPricePaise, lang),
        print: inr(tenant.printPricePaise, lang),
      })
    : t("ui.free");
  const placements = SAMPLE.map(([g, sign]) => ({ label: t(`abbr.${g}`), sign }));

  return (
    <Shell tenant={tenant} me={me}>
      <section className="glow hero">
        <div className="container">
          <div>
            <span className="eyebrow">{t("home.eyebrow")}</span>
            <h1>
              {t("home.titleA")} <em>{t("home.titleB")}</em>
            </h1>
            <p className="lead">{t("home.lead")}</p>
            <div className="hero-cta">
              <a className="btn btn-gold btn-lg" href={start}>
                <Sparkle /> {t("ui.getKundli")}
              </a>
              <span className="hero-price">
                <strong>{price}</strong>
              </span>
            </div>
            <div className="trust">
              <span>
                <Sparkle /> {t("home.trust1")}
              </span>
              <span>
                <Clock /> {t("home.trust2")}
              </span>
              <span>
                <Shield /> {t("home.trust3")}
              </span>
            </div>
          </div>
          <div className="orb" aria-hidden="true">
            <Wheel />
            <div className="orb-chart">
              <NorthChart ascSign={11} ascLabel={t("asc")} placements={placements} title="D1" />
            </div>
            <div className="orb-tag">
              <strong>{t("home.tag")}</strong>
              <span className="muted">{t("home.tagSub")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t("home.featuresEyebrow")}</span>
            <h2>{t("home.featuresTitle")}</h2>
          </div>
          <div className="grid grid-4">
            {[
              [Chart, "home.f1t", "home.f1b"],
              [Clock, "home.f2t", "home.f2b"],
              [Scroll, "home.f3t", "home.f3b"],
              [Globe, "home.f4t", "home.f4b"],
            ].map(([Icon, title, body]) => {
              const C = Icon as typeof Chart;
              return (
                <div className="card feature" key={title as string}>
                  <div className="icon-badge">
                    <C />
                  </div>
                  <h3>{t(title as "home.f1t")}</h3>
                  <p>{t(body as "home.f1b")}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t("home.stepsEyebrow")}</span>
            <h2>{t("home.stepsTitle")}</h2>
          </div>
          <div className="grid grid-3 steps">
            {(["s1", "s2", "s3"] as const).map((s) => (
              <div className="card step" key={s}>
                <h3>{t(`home.${s}t`)}</h3>
                <p className="muted">{t(`home.${s}b`)}</p>
              </div>
            ))}
          </div>
          <div className="glow band" style={{ marginTop: 56 }}>
            <div style={{ position: "relative" }}>
              <h2>{t("home.bandTitle")}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {t("home.bandBody")}
              </p>
            </div>
            <a className="btn btn-gold btn-lg" href={start} style={{ position: "relative" }}>
              <Bolt /> {t("ui.getKundli")}
            </a>
          </div>
        </div>
      </section>
    </Shell>
  );
}

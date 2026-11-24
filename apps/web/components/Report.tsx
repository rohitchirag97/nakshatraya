import {
  AV_PLANETS,
  ashtakavarga,
  currentDasha,
  type GrahaPosition,
  goodPartnerSigns,
  NAKSHATRAS,
  SIGNS,
} from "@jyotish/engine";
import type { createTranslator } from "next-intl";
import type { CSSProperties } from "react";
import { locale as intlLocale } from "@/lib/i18n";
import type { ReportView } from "@/lib/types";
import { NorthChart, type Placement, SouthChart } from "./charts";
import { Wheel } from "./Wheel";

type T = ReturnType<typeof createTranslator>;

const dms = (deg: number) => {
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
};

/** One-line label for a content key, e.g. planet:Mars:house:10 → "Mars in house 10". */
function itemTitle(t: T, key: string) {
  const p = key.split(":");
  if (p[0] === "lagna") return t("lagnaIn", { sign: t(`signs.${p[2]}`) });
  if (p[0] === "moon") return t("moonIn", { nakshatra: t(`nakshatras.${p[2]}`) });
  if (p[0] === "dasha") return t("dashaOf", { lord: t(`planets.${p[1]}`) });
  const planet = t(`planets.${p[1]}`);
  return p[2] === "sign"
    ? t("planetInSign", { planet, sign: t(`signs.${p[3]}`) })
    : t("planetInHouse", { planet, house: p[3] });
}

function statuses(t: T, g: GrahaPosition) {
  const out: string[] = [];
  if (g.retrograde && g.graha !== "Rahu" && g.graha !== "Ketu") out.push(t("status.retrograde"));
  if (g.combust) out.push(t("status.combust"));
  if (g.dignity) out.push(t(`status.${g.dignity}`));
  if (g.boundary) out.push(t("status.boundary"));
  return out.join(", ");
}

export function Report({
  r,
  t,
  pdfHref,
  backLabel = "",
  size = "a4",
  bw = false,
}: {
  r: ReportView;
  t: T;
  pdfHref: string | null;
  backLabel?: string;
  /** Print size: A5 has its own layout (globals.css `.report.a5`). */
  size?: "a4" | "a5";
  /** Black-and-white print: plain black on white (globals.css `.report.bw`). */
  bw?: boolean;
}) {
  const { chart, profile, tenant } = r;
  const locale = intlLocale(r.lang);
  const year = (iso: string) =>
    new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: profile.tz }).format(
      new Date(iso),
    );
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: profile.tz }).format(
      new Date(iso),
    );
  const [birthDate, birthTime] = profile.birthLocal.split(/[ T]/);
  const birthDay = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${birthDate}T00:00:00Z`),
  );

  // Unknown birth time: draw from the Moon's sign (Chandra lagna) and say so.
  const moon = chart.grahas.find((g) => g.graha === "Moon")!;
  const label = (g: GrahaPosition) =>
    `${t(`abbr.${g.graha}`)}${g.retrograde && g.graha !== "Rahu" && g.graha !== "Ketu" ? `(${t("retro")})` : ""}`;
  const d1: Placement[] = chart.grahas.map((g) => ({ label: label(g), sign: g.sign }));
  const d9: Placement[] = chart.grahas.map((g) => ({ label: label(g), sign: g.navamsa }));
  const Drawing = tenant.chartStyle === "south" ? SouthChart : NorthChart;
  const asc1 = chart.lagna?.sign ?? moon.sign;
  const asc9 = chart.lagna?.navamsa ?? moon.navamsa;

  // Readings (lagna, planets, moon, dasha) vs. life areas (doshas, marriage, career, ...).
  const BASE = ["lagna", "planets", "moon", "dasha"];
  const baseSections = r.sections.filter((s) => BASE.includes(s.id));
  const lifeSections = r.sections.filter((s) => !BASE.includes(s.id));
  // A5 charts are ~60 mm wide: bigger labels keep planets readable (~7.5 pt).
  const chartFont = size === "a5" ? 19 : undefined;
  const av = ashtakavarga(chart); // needs the lagna: null when birth time is unknown
  const now = currentDasha(chart.dasha, new Date(r.createdAt));
  const place = profile.place
    ? [profile.place.name, profile.place.admin1, profile.place.country].filter(Boolean).join(", ")
    : "";

  return (
    <main
      className={`report${size === "a5" ? " a5" : ""}${bw ? " bw" : ""}`}
      lang={r.lang}
      style={{ "--brand": tenant.brandColor } as CSSProperties}
    >
      {/* Later than globals.css, so it wins over the A4 @page rule. */}
      {size === "a5" && (
        <style>
          {
            "@page { size: A5; margin: 10mm 0 11mm; @bottom-center { font-size: 7.5pt } } @page :first { margin: 0 }"
          }
        </style>
      )}
      {pdfHref && (
        <div className="actions">
          <a className="btn-link" href="/app">
            ← {backLabel}
          </a>
          <a className="btn btn-primary btn-sm" href={pdfHref}>
            {t("download")}
          </a>
        </div>
      )}

      <section className="page cover">
        <Wheel />
        <div style={{ position: "relative" }}>
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} />
          ) : (
            <span className="brand-name">✦ {tenant.name}</span>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <h1>{t("title")}</h1>
          <div className="rule" />
          <p className="who">{profile.name}</p>
          <p className="when">
            {birthDay}
            {profile.timeKnown ? ` · ${birthTime?.slice(0, 5)}` : ""} · {place}
          </p>
        </div>
        <div className="foot">
          {tenant.footerText && <p>{tenant.footerText}</p>}
          <p style={{ margin: 0 }}>
            {[tenant.name, tenant.contactPhone, tenant.contactEmail].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      <section className="page">
        <h2>{t("birthDetails")}</h2>
        <table>
          <tbody>
            <tr>
              <th>{t("name")}</th>
              <td>{profile.name}</td>
            </tr>
            <tr>
              <th>{t("gender")}</th>
              <td>{t(`genders.${profile.gender}`)}</td>
            </tr>
            <tr>
              <th>{t("dateOfBirth")}</th>
              <td>{birthDay}</td>
            </tr>
            <tr>
              <th>{t("timeOfBirth")}</th>
              <td>{profile.timeKnown ? birthTime?.slice(0, 5) : t("timeUnknown")}</td>
            </tr>
            <tr>
              <th>{t("place")}</th>
              <td>{place}</td>
            </tr>
            <tr>
              <th>{t("coordinates")}</th>
              <td>
                {profile.lat.toFixed(4)}, {profile.lon.toFixed(4)} ({profile.tz})
              </td>
            </tr>
            <tr>
              <th>{t("ayanamsa")}</th>
              <td>
                {t("lahiri")} {dms(chart.ayanamsa)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="charts">
          <figure>
            <Drawing
              ascSign={asc1}
              ascLabel={chart.lagna ? t("asc") : null}
              placements={d1}
              title="D1"
              fontSize={chartFont}
            />
            <figcaption>{chart.lagna ? t("d1") : t("moonChart")}</figcaption>
          </figure>
          <figure>
            <Drawing
              ascSign={asc9}
              ascLabel={chart.lagna ? t("asc") : null}
              placements={d9}
              title="D9"
              fontSize={chartFont}
            />
            <figcaption>{t("d9")}</figcaption>
          </figure>
        </div>
      </section>

      <section className="page">
        {chart.lagna && (
          <>
            <h2>{t("chandra")}</h2>
            <figure className="chart-solo">
              <Drawing
                ascSign={moon.sign}
                ascLabel={null}
                placements={d1}
                title={t("chandraShort")}
                fontSize={chartFont}
              />
              <figcaption className="note">{t("chandraNote")}</figcaption>
            </figure>
          </>
        )}

        <h2>{t("positions")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("cols.graha")}</th>
              <th>{t("cols.sign")}</th>
              <th>{t("cols.degree")}</th>
              <th>{t("cols.nakshatra")}</th>
              <th>{t("cols.pada")}</th>
              {chart.lagna && <th>{t("cols.house")}</th>}
              <th>{t("cols.status")}</th>
            </tr>
          </thead>
          <tbody>
            {chart.lagna && (
              <tr>
                <td>{t("lagna")}</td>
                <td>{t(`signs.${SIGNS[chart.lagna.sign]}`)}</td>
                <td>{dms(chart.lagna.deg)}</td>
                <td>{t(`nakshatras.${NAKSHATRAS[chart.lagna.nakshatra]}`)}</td>
                <td>{chart.lagna.pada}</td>
                <td>1</td>
                <td>{chart.lagna.boundary ? t("status.boundary") : ""}</td>
              </tr>
            )}
            {chart.grahas.map((g) => (
              <tr key={g.graha}>
                <td>{t(`planets.${g.graha}`)}</td>
                <td>{t(`signs.${SIGNS[g.sign]}`)}</td>
                <td>{dms(g.deg)}</td>
                <td>{t(`nakshatras.${NAKSHATRAS[g.nakshatra]}`)}</td>
                <td>{g.pada}</td>
                {chart.lagna && <td>{g.house}</td>}
                <td>{statuses(t, g)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {av && chart.lagna && (
        <section className="page">
          <h2>{t("ashtakavarga")}</h2>
          <div className="av-grid">
            {[...AV_PLANETS, "Sarva" as const].map((p) => {
              const pts = p === "Sarva" ? av.sav : av.bav[p];
              const name = p === "Sarva" ? t("sarva") : t(`planets.${p}`);
              return (
                <figure key={p} className={p === "Sarva" ? "sarva" : undefined}>
                  <Drawing
                    ascSign={chart.lagna!.sign}
                    ascLabel={null}
                    markAsc
                    placements={pts.map((n, sign) => ({ label: String(n), sign }))}
                    title={p === "Sarva" ? t("sarvaShort") : t(`abbr.${p}`)}
                    fontSize={40}
                  />
                  <figcaption>
                    {name} <span>{pts.reduce((a, b) => a + b, 0)}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <div className="av-scroll">
            <table className="av-table">
              <thead>
                <tr>
                  <th />
                  {SIGNS.map((s) => (
                    <th key={s}>
                      {/* 12 narrow columns: English names shortened, Indic names already fit */}
                      {r.lang === "en" ? t(`signs.${s}`).slice(0, 3) : t(`signs.${s}`)}
                    </th>
                  ))}
                  <th>{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {AV_PLANETS.map((p) => (
                  <tr key={p}>
                    <th>{t(`planets.${p}`)}</th>
                    {av.bav[p].map((n, i) => (
                      <td key={SIGNS[i]}>{n}</td>
                    ))}
                    <td>{av.bav[p].reduce((a, b) => a + b, 0)}</td>
                  </tr>
                ))}
                <tr className="sav-row">
                  <th>{t("sarvaShort")}</th>
                  {av.sav.map((n, i) => (
                    <td key={SIGNS[i]} className={n >= 28 ? "strong" : undefined}>
                      {n}
                    </td>
                  ))}
                  <td>{av.sav.reduce((a, b) => a + b, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note">{t("avNote")}</p>
        </section>
      )}

      <section className="page">
        <h2>{t("dasha")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("mahadasha")}</th>
              <th>{t("from")}</th>
              <th>{t("to")}</th>
            </tr>
          </thead>
          <tbody>
            {chart.dasha.map((m) => (
              <tr key={m.start} className={m.start === now?.md.start ? "current" : undefined}>
                <td>
                  {t(`planets.${m.lord}`)}
                  {m.start === now?.md.start ? ` · ${t("current")}` : ""}
                </td>
                <td>{date(m.start)}</td>
                <td>{date(m.end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {now && (
          <>
            <h3>{t("antardashasOf", { lord: t(`planets.${now.md.lord}`) })}</h3>
            <table>
              <thead>
                <tr>
                  <th>{t("antardasha")}</th>
                  <th>{t("from")}</th>
                  <th>{t("to")}</th>
                </tr>
              </thead>
              <tbody>
                {now.md.antardashas.map((a) => (
                  <tr key={a.start} className={a.start === now.ad?.start ? "current" : undefined}>
                    <td>{t(`planets.${a.lord}`)}</td>
                    <td>{date(a.start)}</td>
                    <td>{date(a.end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="page">
        <h2>{t("allAntardashas")}</h2>
        <div className="dasha-grid">
          {chart.dasha.map((m) => {
            const isNow = m.start === now?.md.start;
            return (
              <div className={`dasha-block${isNow ? " current" : ""}`} key={m.start}>
                <h4>
                  {t(`planets.${m.lord}`)}{" "}
                  <span>
                    {year(m.start)}–{year(m.end)}
                  </span>
                </h4>
                <table>
                  <tbody>
                    {m.antardashas.map((a) => (
                      <tr
                        key={a.start}
                        className={isNow && a.start === now?.ad?.start ? "current" : undefined}
                      >
                        <td>{t(`planets.${a.lord}`)}</td>
                        <td className="num">{date(a.start)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
        <p className="note">{t("antardashaNote")}</p>
      </section>

      {lifeSections.length > 0 && (
        <section className="page flow">
          {lifeSections.map((s) => {
            const items = s.items.filter((it) => !/^(obstacle|remedy):/.test(it.key));
            const obstacles = s.items.filter((it) => it.key.startsWith("obstacle:"));
            const remedies = s.items.filter((it) => it.key.startsWith("remedy:"));
            return (
              <div className="life-block" key={s.id}>
                <h2>{t(`sections.${s.id}`)}</h2>
                <div className="life-group">
                  {s.id !== "doshas" && <h4 className="tag">{t("life.indications")}</h4>}
                  {items.map((it) => (
                    <p key={it.key}>{it.text}</p>
                  ))}
                  {s.id === "marriage" && (
                    <p className="good-rashis">
                      <strong>{t("life.goodRashis")}:</strong>{" "}
                      {goodPartnerSigns(moon.sign)
                        .map((sign) => t(`signs.${SIGNS[sign]}`))
                        .join(", ")}
                    </p>
                  )}
                </div>
                {s.id !== "doshas" && s.id !== "foreign" && (
                  <div className="life-group obstacles">
                    <h4 className="tag">{t("life.obstacles")}</h4>
                    {obstacles.length ? (
                      obstacles.map((it) => <p key={it.key}>{it.text}</p>)
                    ) : (
                      <p className="muted">{t("life.noObstacle")}</p>
                    )}
                  </div>
                )}
                {remedies.length > 0 && (
                  <div className="life-group remedies">
                    <h4 className="tag">{t("life.remedies")}</h4>
                    {remedies.map((it) => (
                      <p key={it.key}>{it.text}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <p className="note">{t("life.remedyNote")}</p>
        </section>
      )}

      <section className="page">
        {baseSections.map((s) => (
          <div key={s.id}>
            <h2>{t(`sections.${s.id}`)}</h2>
            {s.items.map((it) => (
              <div className="item" key={it.key}>
                <h3>{itemTitle(t, it.key)}</h3>
                <p>{it.text}</p>
              </div>
            ))}
          </div>
        ))}
        <p className="note">
          {t("generated", { date: date(r.createdAt), version: chart.engineVersion })} ·{" "}
          {t("placesCredit")}
        </p>
      </section>
    </main>
  );
}

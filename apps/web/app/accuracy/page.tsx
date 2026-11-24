import {
  compareGolden,
  ENGINE_VERSION,
  GOLDEN_TARGET,
  goldenCases,
  TOLERANCE_ARCMIN,
} from "@jyotish/engine";
import { notFound } from "next/navigation";
import { getMe, Shell } from "@/components/Shell";
import { Wheel } from "@/components/Wheel";
import { apiJson, type PublicTenant } from "@/lib/api";

// Public accuracy page (PRD risk mitigation). Results are computed live from the golden set, so the page
// can never claim more than the test suite proves. shortcut: English only.
export default async function AccuracyPage() {
  const { status, data: tenant } = await apiJson<PublicTenant>("/api/tenant");
  if (status !== 200) notFound();
  const results = goldenCases.map(compareGolden);
  const passing = results.filter((r) => r.off.length === 0).length;
  const worst = results.reduce((m, r) => Math.max(m, r.worst), 0);
  const me = await getMe();
  return (
    <Shell tenant={tenant} me={me} active="accuracy">
      <section className="glow" style={{ padding: "56px 0" }}>
        <div
          className="container"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <div>
            <span className="eyebrow">Accuracy</span>
            <h1 style={{ marginTop: 14 }}>How accurate are our charts?</h1>
            <p className="muted" style={{ maxWidth: 560, margin: 0 }}>
              Every planet and the lagna within {TOLERANCE_ARCMIN} arcminute (1/60 of a degree) of
              Jagannatha Hora, checked automatically on every change to our calculation engine.
            </p>
          </div>
          <Wheel className="wheel hide-sm" />
        </div>
      </section>
      <main className="page-main">
        <div className="container grid grid-3">
          <section className="card">
            <h3>Status</h3>
            {results.length === 0 ? (
              <p className="notice">
                Comparison in progress: 0 of {GOLDEN_TARGET} reference charts checked so far.
              </p>
            ) : (
              <p className="notice">
                {results.length} of {GOLDEN_TARGET} reference charts checked: {passing} within{" "}
                {TOLERANCE_ARCMIN}′. Largest difference: {worst.toFixed(2)}′.
              </p>
            )}
            <p className="muted small" style={{ margin: 0 }}>
              Reference set: {GOLDEN_TARGET} charts from 1900 to 2050 for Indian cities.
            </p>
          </section>
          <section className="card">
            <h3>How charts are calculated</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li>Sidereal zodiac, Lahiri (Chitrapaksha) ayanamsa.</li>
              <li>Apparent planetary positions; mean Rahu and Ketu.</li>
              <li>Whole-sign houses; Navamsa from 3°20′ divisions.</li>
              <li>Vimshottari dasha from the Moon, 365.25-day year.</li>
              <li>Historical time zones, including India&apos;s 1942–45 war time.</li>
              <li>Planets within 0.1° of a sign or nakshatra edge are flagged.</li>
              <li>Each report records its engine version (now {ENGINE_VERSION}).</li>
            </ul>
          </section>
          <section className="card">
            <h3>Data and software</h3>
            <p className="muted" style={{ margin: 0 }}>
              Place names and coordinates: <a href="https://www.geonames.org/">GeoNames.org</a>,{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Planetary
              positions: <a href="https://github.com/cosinekitty/astronomy">Astronomy Engine</a>{" "}
              (MIT). All calculations run on our own servers.
            </p>
          </section>
        </div>
      </main>
    </Shell>
  );
}

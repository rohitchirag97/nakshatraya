import type { ReactNode } from "react";
import { ApplyForm } from "./ApplyForm";
import { Chart, Globe, Scroll, Shield } from "./Icons";
import { Wheel } from "./Wheel";

// The platform's own website (the root domain, no tenant): partner landing page and admin panel.
export const PLATFORM_NAME = process.env.PLATFORM_NAME ?? "Nakshtraya";

/** Platform pages only (tenant sites are white-label and never show our brand). */
export const platformIcons = {
  icon: "/brand/nakshtraya-32.png",
  apple: "/brand/nakshtraya-mark.png",
};

export function PlatformShell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  return (
    <div className="tenant">
      <header className="site-header">
        <div className="container">
          <a className="brand-mark" href="/">
            <img
              className="platform-logo"
              src="/brand/nakshtraya-logo.png"
              alt={PLATFORM_NAME}
              width={494}
              height={144}
            />
          </a>
          <nav className="nav" aria-label="Main">
            {nav ?? (
              <a className="btn btn-primary btn-sm" href="#apply">
                Apply now
              </a>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="container">
          <span>© {PLATFORM_NAME}</span>
          <span>Kundli reports for astrologers, under your own brand.</span>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  [
    Globe,
    "Your brand, your site",
    "Your name, logo and colours on your own web address. Customers never see ours.",
  ],
  [
    Chart,
    "Accurate kundli in seconds",
    "D1, D9, Chandra kundli, Ashtakavarga, dashas, doshas and life areas, in English, Hindi and Gujarati.",
  ],
  [
    Scroll,
    "Your prices",
    "Set your own price for the PDF and for printed copies you post. Add a shop or online consultation if you want them.",
  ],
  [
    Shield,
    "Paid straight to you",
    "Customers pay online; your share goes to your own bank account with GST invoices made for you.",
  ],
] as const;

export function PlatformHome() {
  return (
    <PlatformShell>
      <section className="glow hero">
        <div className="container">
          <div>
            <span className="eyebrow">For astrologers</span>
            <h1>
              Sell kundli reports <em>under your own brand.</em>
            </h1>
            <p className="lead">
              Your own website where customers enter their birth details, pay you, and get a
              detailed kundli PDF instantly. No software to install.
            </p>
            <div className="hero-cta">
              <a className="btn btn-gold btn-lg" href="#apply">
                Apply to join
              </a>
              <span className="hero-price">Set up within two working days</span>
            </div>
          </div>
          <div className="orb" aria-hidden="true">
            <Wheel />
            <img
              className="orb-mascot"
              src="/brand/nakshtraya-mascot.png"
              alt=""
              width={480}
              height={480}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">What you get</span>
            <h2>Everything you need to sell kundlis online</h2>
          </div>
          <div className="grid grid-4">
            {FEATURES.map(([Icon, title, body]) => (
              <div className="card feature" key={title}>
                <div className="icon-badge">
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="apply" style={{ paddingTop: 0 }}>
        <div className="container apply-grid">
          <div className="section-head">
            <span className="eyebrow">Apply</span>
            <h2>Start selling under your name</h2>
            <p className="muted">
              Tell us about your practice and what you want to offer. We review every application
              and call you to set up your site.
            </p>
          </div>
          <ApplyForm />
        </div>
      </section>
    </PlatformShell>
  );
}

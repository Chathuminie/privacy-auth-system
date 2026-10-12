import Link from "next/link";
import { SecurityIcon } from "@/components/security-icon";
import { StudioBrand } from "@/components/studio-brand";

const benefits = [
  { icon: "shield" as const, title: "More privacy", subtitle: "Less personal data." },
  { icon: "key" as const, title: "No passwords", subtitle: "Sign in with a passkey." },
  { icon: "lock" as const, title: "Your control", subtitle: "Manage your credentials." },
];

export default function HomePage() {
  return (
    <div className="pa-public-page">
      <header className="pa-site-header">
        <div className="pa-site-nav">
          <StudioBrand />
          <nav className="pa-nav-links" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#security">Security</a>
            <a href="https://github.com/Chathuminie/privacy-auth-system" target="_blank" rel="noopener noreferrer">Source <span aria-hidden="true">↗</span></a>
          </nav>
          <div className="pa-site-actions">
            <Link className="pa-button-link" href="/login">Sign in</Link>
            <Link className="pa-button" href="/register">Create account <SecurityIcon name="arrow" className="pa-button-icon" /></Link>
          </div>
        </div>
      </header>

      <main className="pa-site-container">
        <section className="pa-hero" aria-labelledby="pa-hero-title">
          <div className="pa-hero-copy">
            <p className="pa-kicker">PASSKEY AUTHENTICATION</p>
            <h1 id="pa-hero-title" className="pa-hero-title">Access<br /><em>on your terms.</em></h1>
            <p className="pa-hero-description">A simpler, more private way to sign in without passwords.</p>
            <div className="pa-hero-ctas">
              <Link href="/register" className="pa-button">Get started <SecurityIcon name="arrow" className="pa-button-icon" /></Link>
              <Link href="/login" className="pa-button pa-button-outline">I have a passkey</Link>
            </div>
            <p className="pa-hero-footnote">Built with WebAuthn. No name, email or password required.</p>
          </div>
          <div className="pa-hero-visual" aria-label="Illustration of a device-held passkey; not a live authentication status">
            <div className="pa-orbit pa-orbit-outer" aria-hidden="true" />
            <div className="pa-orbit pa-orbit-inner" aria-hidden="true" />
            <div className="pa-passkey-stack" aria-hidden="true">
              <div className="pa-passkey-layer pa-passkey-layer-three" />
              <div className="pa-passkey-layer pa-passkey-layer-two" />
              <div className="pa-passkey-layer pa-passkey-layer-main">
                <SecurityIcon name="key" className="pa-passkey-glyph" />
              </div>
            </div>
            <div className="pa-passkey-label"><span className="pa-status-dot" /> Protected by your passkey</div>
          </div>
        </section>

        <section className="pa-benefit-strip" aria-label="Privacy Auth benefits">
          {benefits.map((benefit) => (
            <div className="pa-benefit" key={benefit.title}>
              <span className="pa-benefit-icon"><SecurityIcon name={benefit.icon} className="pa-small-icon" /></span>
              <div><strong>{benefit.title}</strong><span>{benefit.subtitle}</span></div>
            </div>
          ))}
        </section>

        <section className="pa-simple-section" id="how-it-works" aria-labelledby="pa-how-title">
          <div><p className="pa-kicker">HOW IT WORKS</p><h2 id="pa-how-title">Three steps.<br /><em>Nothing extra.</em></h2></div>
          <div className="pa-simple-steps">
            <div><span>01</span><strong>Create a passkey</strong><small>Use your device or passkey provider.</small></div>
            <div><span>02</span><strong>Verify it&apos;s you</strong><small>Approve the browser&apos;s prompt.</small></div>
            <div><span>03</span><strong>Access your account</strong><small>Manage passkeys and account data.</small></div>
          </div>
        </section>

        <section className="pa-quiet-note" id="security">
          <SecurityIcon name="shield" className="pa-small-icon" />
          <div><strong>Privacy is built in.</strong><p>Public-key authentication, pseudonymous accounts and hashed session tokens.</p></div>
          <Link href="/register" className="pa-button-link">Try the prototype <span aria-hidden="true">↗</span></Link>
        </section>
      </main>
      <footer className="pa-footer"><div className="pa-site-container pa-footer-inner"><span>Privacy Auth © {new Date().getFullYear()}</span><span>Local engineering prototype · Not production-certified</span></div></footer>
    </div>
  );
}

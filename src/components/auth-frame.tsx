import Link from "next/link";
import type { ReactNode } from "react";
import { StudioBrand } from "@/components/studio-brand";
import { SecurityIcon } from "@/components/security-icon";

export function AuthFrame({ variant, children }: { variant: "login" | "register"; children: ReactNode }) {
  const isLogin = variant === "login";
  return (
    <div className="pa-auth-page">
      <header className="pa-auth-header"><div className="pa-auth-header-inner"><StudioBrand /><Link href="/" className="pa-button-link">← Back to home</Link></div></header>
      <main className="pa-auth-content">
        <section className="pa-auth-context">
          <p className="pa-kicker">PASSKEY AUTHENTICATION</p>
          <h1>{isLogin ? <>Welcome<br /><em>back.</em></> : <>Start with<br /><em>a passkey.</em></>}</h1>
          <p>{isLogin ? "No password to remember. Just confirm it's you." : "A private way to access your account, without creating a password."}</p>
          <div className="pa-auth-small-visual" aria-hidden="true"><SecurityIcon name={isLogin ? "shield" : "key"} className="pa-auth-large-icon" /></div>
        </section>
        <section className="pa-auth-form">{children}</section>
      </main>
      <footer className="pa-footer"><div className="pa-auth-header-inner pa-auth-footer-inner"><span>Privacy Auth · Local prototype</span><span>WebAuthn / Passkeys</span></div></footer>
    </div>
  );
}

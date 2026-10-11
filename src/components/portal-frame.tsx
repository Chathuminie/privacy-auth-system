import type { ReactNode } from "react";
import Link from "next/link";
import { SecurityIcon } from "@/components/security-icon";

type Area = "overview" | "passkeys" | "privacy";

export function PortalFrame({
  area,
  eyebrow,
  heading,
  description,
  children,
  action,
}: {
  area: Area;
  eyebrow: string;
  heading: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const nav: { label: string; href: string; area: Area }[] = [
    { label: "Overview", href: "/dashboard", area: "overview" },
    { label: "Passkeys", href: "/dashboard/passkeys", area: "passkeys" },
    { label: "Privacy", href: "/dashboard/privacy", area: "privacy" },
  ];
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060e1b] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_12%_0%,rgba(34,211,238,0.12),transparent_48%),radial-gradient(ellipse_at_90%_5%,rgba(20,184,166,0.08),transparent_42%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[linear-gradient(rgba(148,163,184,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <header className="relative z-10 border-b border-white/10 bg-[#081423]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-cyan-300" aria-label="Privacy Auth home">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.1)]"><SecurityIcon name="shield" className="h-6 w-6" /></span>
            <span className="leading-tight"><span className="block text-lg font-bold tracking-tight text-white">privacy<span className="text-cyan-300">auth.</span></span><span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Identity console</span></span>
          </Link>
          <nav aria-label="Dashboard navigation" className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-2 sm:w-auto">
            {nav.map((item) => (
              <Link key={item.area} href={item.href} aria-current={area === item.area ? "page" : undefined} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${area === item.area ? "border border-cyan-300/20 bg-cyan-300/10 text-cyan-200" : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</Link>
            ))}
          </nav>
          <form className="order-2 sm:order-3" action="/api/auth/logout" method="post"><button type="submit" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-cyan-300/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Log out <span aria-hidden="true">↗</span></button></form>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.21em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.7)]" />{eyebrow}</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-white sm:text-5xl lg:text-[58px]">{heading}</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-400">{description}</p>
          </div>
          {action}
        </div>
        {children}
      </main>
      <footer className="relative z-10 border-t border-white/10 bg-[#07111f]/80">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-6 text-xs text-slate-500 sm:px-8"><span>© {new Date().getFullYear()} Privacy Auth</span><span>Local portfolio prototype · Not production-certified</span></div>
      </footer>
    </div>
  );
}

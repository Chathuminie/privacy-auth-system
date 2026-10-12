import type { ReactNode } from "react";
import Link from "next/link";
import { StudioBrand } from "@/components/studio-brand";
import { SecurityIcon } from "@/components/security-icon";

type Area = "overview" | "passkeys" | "privacy";

const destinations: { label: string; href: string; area: Area; icon: "layers" | "key" | "shield" }[] = [
  { label: "Home", href: "/dashboard", area: "overview", icon: "layers" },
  { label: "Passkeys", href: "/dashboard/passkeys", area: "passkeys", icon: "key" },
  { label: "Privacy", href: "/dashboard/privacy", area: "privacy", icon: "shield" },
];

function LogoutButton() {
  return <form action="/api/auth/logout" method="post"><button type="submit" className="pa-logout">Sign out <span aria-hidden="true">↗</span></button></form>;
}

export function PortalFrame({ area, eyebrow, heading, description, children, action }: {
  area: Area;
  eyebrow: string;
  heading: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pa-app">
      <aside className="pa-sidebar">
        <StudioBrand />
        <nav className="pa-side-nav" aria-label="Account navigation">
          {destinations.map((item) => (
            <Link key={item.area} href={item.href} className="pa-side-link" aria-current={area === item.area ? "page" : undefined}>
              <SecurityIcon name={item.icon} className="pa-small-icon" /><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="pa-side-bottom"><span className="pa-sidebar-caption">ACCOUNT WORKSPACE</span><LogoutButton /></div>
      </aside>
      <div className="pa-app-main">
        <header className="pa-app-top">
          <span className="pa-mobile-brand"><StudioBrand /></span>
          <span className="pa-app-section-name">Privacy Auth <span className="pa-app-section-divider">/</span> {area === "overview" ? "Home" : area === "passkeys" ? "Passkeys" : "Privacy"}</span>
          <div className="pa-app-top-right"><span className="pa-status"><span className="pa-status-dot" /> Session active</span><div className="pa-mobile-logout"><LogoutButton /></div></div>
        </header>
        <nav className="pa-mobile-nav" aria-label="Mobile account navigation">
          {destinations.map((item) => <Link key={item.area} href={item.href} aria-current={area === item.area ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <main className="pa-app-inner">
          <header className="pa-app-heading">
            <div><p className="pa-kicker">{eyebrow}</p><h1>{heading}</h1><p>{description}</p></div>
            {action}
          </header>
          <div className="pa-content">{children}</div>
        </main>
        <footer className="pa-app-footer"><span>Privacy Auth · Local prototype</span><Link href="/">Project home <span aria-hidden="true">↗</span></Link></footer>
      </div>
    </div>
  );
}

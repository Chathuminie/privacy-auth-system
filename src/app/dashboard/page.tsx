import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PortalFrame } from "@/components/portal-frame";
import { SecurityIcon } from "@/components/security-icon";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) redirect("/login");
  const session = await getSessionFromToken(sessionToken);
  if (!session) redirect("/login");

  const passkeyCount = await prisma.passkey.count({ where: { userId: session.user.id } });

  return (
    <PortalFrame area="overview" eyebrow="YOUR WORKSPACE" heading="Welcome back." description="Your access, in one place.">
      <section className="pa-dashboard-grid" aria-label="Account overview">
        <article className="pa-dashboard-passkeys">
          <div className="pa-dashboard-card-top">
            <span className="pa-tile-icon"><SecurityIcon name="key" className="pa-medium-icon" /></span>
            <Link href="/dashboard/passkeys" className="pa-icon-link" aria-label="Manage your passkeys"><SecurityIcon name="arrow" className="pa-small-icon" /></Link>
          </div>
          <h2>Your passkeys</h2>
          <p>Credentials linked to this account.</p>
          <div className="pa-dashboard-count-row"><div><strong>{passkeyCount}</strong><span>registered {passkeyCount === 1 ? "passkey" : "passkeys"}</span></div><Link href="/dashboard/passkeys" className="pa-round-add" aria-label="Go to passkey management">+</Link></div>
        </article>
        <article className="pa-dashboard-session">
          <div className="pa-dashboard-card-top"><span className="pa-tile-icon"><SecurityIcon name="shield" className="pa-medium-icon" /></span><span className="pa-status"><span className="pa-status-dot" /> Active</span></div>
          <h2>Current session</h2>
          <p>Signed in with a passkey.</p>
          <dl className="pa-compact-list"><div><dt>Method</dt><dd>WebAuthn</dd></div><div><dt>Expires</dt><dd>{session.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div></dl>
        </article>
        <Link className="pa-dashboard-privacy" href="/dashboard/privacy">
          <span className="pa-tile-icon"><SecurityIcon name="lock" className="pa-medium-icon" /></span>
          <span className="pa-dashboard-privacy-copy"><strong>Your privacy</strong><small>View and export your account data.</small></span>
          <SecurityIcon name="chevron" className="pa-small-icon" />
        </Link>
      </section>
      <p className="pa-dashboard-disclaimer">This account uses a pseudonymous ID. No name, email or password is required.</p>
    </PortalFrame>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { PortalFrame } from "@/components/portal-frame";
import DeleteAccountButton from "./delete-account-button";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  const session = await getSessionFromToken(token);
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, createdAt: true, updatedAt: true,
      _count: { select: { passkeys: true, sessions: true, challenges: true } },
    },
  });
  if (!user) redirect("/login");

  return (
    <PortalFrame area="privacy" eyebrow="YOUR DATA" heading="Privacy & data" description="See what's stored. Stay in control.">
      <section className="pa-stat-strip" aria-label="Saved account records">
        <div className="pa-stat"><p className="pa-label">Passkeys</p><strong>{user._count.passkeys}</strong><small>Credential records</small></div>
        <div className="pa-stat"><p className="pa-label">Sessions</p><strong>{user._count.sessions}</strong><small>Including records awaiting cleanup</small></div>
        <div className="pa-stat"><p className="pa-label">Challenges</p><strong>{user._count.challenges}</strong><small>Temporary verification records</small></div>
      </section>
      <div className="pa-privacy-grid">
        <section aria-labelledby="pa-account-data-heading"><p className="pa-kicker">ACCOUNT</p><h2 id="pa-account-data-heading">Pseudonymous by design</h2><p>No name, email or password field is stored in this app&apos;s account schema.</p>
          <dl className="pa-data-list"><div style={{ display: "block" }}><dt>Account ID</dt><dd className="pa-long-value" style={{ marginTop: 9 }}>{user.id}</dd></div><div><dt>Created</dt><dd>{user.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div><div><dt>Updated</dt><dd>{user.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div></dl>
        </section>
        <section aria-labelledby="pa-data-boundaries-heading"><p className="pa-kicker">DATA BOUNDARIES</p><h2 id="pa-data-boundaries-heading">Only what&apos;s needed</h2><p>Public-key credentials, session-token hashes and temporary challenges support authentication.</p><p>No biometric images or private passkey keys are stored here.</p><p>Expired records may remain until cleanup; external infrastructure logging is outside this database description.</p></section>
      </div>
      <section className="pa-privacy-action" aria-labelledby="pa-export-heading"><div><h2 id="pa-export-heading">Export your data</h2><p>Download account and credential metadata as JSON, excluding secrets.</p></div><a href="/api/privacy/export" className="pa-button">Download JSON <span aria-hidden="true">↗</span></a></section>
      <section className="pa-danger" aria-labelledby="pa-delete-heading"><p className="pa-kicker" style={{ color: "var(--danger)" }}>DANGER ZONE</p><h2 id="pa-delete-heading">Delete your account</h2><DeleteAccountButton /></section>
    </PortalFrame>
  );
}

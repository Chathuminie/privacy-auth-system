import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { PortalFrame } from "@/components/portal-frame";
import { SecurityIcon } from "@/components/security-icon";
import AddPasskeyButton from "./add-passkey-button";
import RemovePasskeyButton from "./remove-passkey-button";

export default async function PasskeysPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) redirect("/login");
  const session = await getSessionFromToken(sessionToken);
  if (!session) redirect("/login");
  const passkeys = await prisma.passkey.findMany({
    where: { userId: session.user.id },
    select: { id: true, deviceType: true, backedUp: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PortalFrame area="passkeys" eyebrow="YOUR CREDENTIALS" heading="Passkeys" description="Manage how you sign in.">
      <section className="pa-stat-strip" aria-label="Credential overview">
        <div className="pa-stat"><p className="pa-label">Registered passkeys</p><strong>{passkeys.length}</strong><small>Linked to this account</small></div>
        <div className="pa-stat"><p className="pa-label">Credential changes</p><strong>Verified</strong><small>Fresh confirmation for removal</small></div>
        <div className="pa-stat"><p className="pa-label">Last passkey</p><strong>Protected</strong><small>Cannot be removed</small></div>
      </section>
      <section className="pa-records" aria-labelledby="pa-credentials-heading">
        <header className="pa-records-head"><div><h2 id="pa-credentials-heading">Your credentials</h2><p>Your private keys remain with your authenticator.</p></div><AddPasskeyButton /></header>
        {passkeys.length === 0 ? <div className="pa-record"><p className="pa-muted">No passkeys found.</p></div> : passkeys.map((passkey, index) => (
          <article className="pa-record" key={passkey.id}>
            <div className="pa-record-top">
              <span className="pa-record-icon"><SecurityIcon name="key" className="pa-small-icon" /></span>
              <div style={{ minWidth: 0, flex: 1 }}><h3>Passkey {String(index + 1).padStart(2, "0")}</h3><p className="pa-record-code">ID · {passkey.id.slice(0, 18)}…</p></div>
              <span className="pa-status"><span className="pa-status-dot" /> Registered</span>
            </div>
            <div className="pa-record-fields">
              <div><span>Type</span><strong>{passkey.deviceType === "multiDevice" ? "Multi-device" : "Single-device"}</strong></div>
              <div><span>Backup</span><strong>{passkey.backedUp ? "Backed up" : "Not backed up"}</strong></div>
              <div><span>Added</span><strong>{passkey.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</strong></div>
            </div>
            <div className="pa-record-actions"><RemovePasskeyButton passkeyId={passkey.id} canRemove={passkeys.length > 1} /></div>
          </article>
        ))}
      </section>
      <div className="pa-info-section"><p>For safety, you must verify with a passkey before removing one. Keep at least one passkey registered; this prototype has no separate account recovery process.</p></div>
    </PortalFrame>
  );
}

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
    <PortalFrame area="passkeys" eyebrow="Credential management" heading="Your keys. Your control." description="Manage the passkeys connected to your identity. Sensitive credential changes require fresh authentication, and your final passkey cannot be removed.">
      <section className="grid gap-5 sm:grid-cols-3" aria-label="Passkey overview">
        <div className="rounded-[22px] border border-white/10 bg-[#0e1b2e] p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><SecurityIcon name="key" className="h-6 w-6" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.13em] text-slate-400">Registered credentials</p><p className="mt-1 text-4xl font-semibold text-white">{passkeys.length}</p></div>
        <div className="rounded-[22px] border border-white/10 bg-[#0e1b2e] p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-300/10 text-teal-200"><SecurityIcon name="shield" className="h-6 w-6" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.13em] text-slate-400">Removal protection</p><p className="mt-2 text-lg font-semibold text-white">Fresh passkey verification</p></div>
        <div className="rounded-[22px] border border-white/10 bg-[#0e1b2e] p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><SecurityIcon name="lock" className="h-6 w-6" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.13em] text-slate-400">Recovery safeguard</p><p className="mt-2 text-lg font-semibold text-white">Last passkey protected</p></div>
      </section>
      <section className="mt-7 rounded-[26px] border border-white/10 bg-[#0e1b2e] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-7"><div><h2 className="text-2xl font-semibold tracking-tight text-white">Registered passkeys</h2><p className="mt-2 max-w-xl text-sm leading-7 text-slate-400">Each credential belongs to this account. Use a supported device or provider to register an additional passkey.</p></div><AddPasskeyButton /></div>
        {passkeys.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-white/15 bg-white/[0.025] p-7 text-center"><p className="text-sm text-slate-300">No passkeys were found for this account.</p></div> : <div className="mt-6 grid gap-4">{passkeys.map((passkey, index) => (
          <article key={passkey.id} className="rounded-[20px] border border-white/10 bg-[#0a1728] p-5 transition-colors hover:border-cyan-300/25 sm:p-6">
            <div className="flex flex-wrap items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200"><SecurityIcon name="fingerprint" className="h-6 w-6" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-semibold text-white">Passkey {String(index + 1).padStart(2,"0")}</h3><span className="rounded-full border border-teal-300/20 bg-teal-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-200">Registered</span></div><p className="mt-1 break-all font-mono text-xs text-slate-500">Credential {passkey.id.slice(0, 15)}…</p></div></div>
            <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3"><div><p className="text-xs font-medium text-slate-500">Authenticator type</p><p className="mt-1 text-sm font-semibold text-slate-200">{passkey.deviceType === "multiDevice" ? "Multi-device" : "Single-device"}</p></div><div><p className="text-xs font-medium text-slate-500">Backed up</p><p className="mt-1 text-sm font-semibold text-slate-200">{passkey.backedUp ? "Yes" : "No"}</p></div><div><p className="text-xs font-medium text-slate-500">Registered on</p><p className="mt-1 text-sm font-semibold text-slate-200">{passkey.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div></div>
            <div className="mt-5 border-t border-white/10 pt-4"><RemovePasskeyButton passkeyId={passkey.id} canRemove={passkeys.length > 1} /></div>
          </article>
        ))}</div>}
      </section>
      <aside className="mt-6 flex items-start gap-4 rounded-[20px] border border-cyan-300/15 bg-cyan-300/[0.045] p-5 text-sm leading-7 text-slate-300"><SecurityIcon name="shield" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" /><p><strong className="font-semibold text-white">Security note.</strong> Adding a passkey requires a recent login. Removing a passkey requires a fresh WebAuthn verification and is blocked if it would leave the account with no passkeys.</p></aside>
    </PortalFrame>
  );
}

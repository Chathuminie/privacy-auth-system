
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DeleteAccountButton from "./delete-account-button";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await getSessionFromToken(token);

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          passkeys: true,
          sessions: true,
          challenges: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-white"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="mt-8 text-4xl font-bold">
          Privacy Settings
        </h1>

        <p className="mt-3 text-gray-400">
          Understand and manage information stored
          about your pseudonymous account.
        </p>

        <section className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">
            Your Account
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <p className="break-all">
              <span className="text-gray-400">
                User ID:
              </span>{" "}
              {user.id}
            </p>

            <p>
              <span className="text-gray-400">
                Created:
              </span>{" "}
              {user.createdAt.toLocaleDateString()}
            </p>

            <p>
              <span className="text-gray-400">
                Last updated:
              </span>{" "}
              {user.updatedAt.toLocaleDateString()}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">
            Stored Account Data
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-700 p-4">
              <p className="text-sm text-gray-400">
                Passkeys
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {user._count.passkeys}
              </p>
            </div>

            <div className="rounded-lg border border-gray-700 p-4">
              <p className="text-sm text-gray-400">
                Session records
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {user._count.sessions}
              </p>
            </div>

            <div className="rounded-lg border border-gray-700 p-4">
              <p className="text-sm text-gray-400">
                Temporary challenges
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {user._count.challenges}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            Session records may include expired
            sessions awaiting cleanup. Challenges
            are temporary WebAuthn records associated
            with your account.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">
            Data Minimization
          </h2>

          <p className="mt-3 text-sm leading-7 text-gray-300">
            The current application database schema
            does not define passwords, email addresses,
            names, or biometric images. Passkey
            authentication uses credential identifiers,
            public keys, and signature counters.
            Session tokens are stored as hashes.
          </p>

          <p className="mt-3 text-sm text-gray-400">
            These statements describe the application
            database schema, not infrastructure or
            browser logs.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">
            Export Your Data
          </h2>

          <p className="mt-3 text-sm text-gray-400">
            Download account information, passkey
            metadata, session metadata, and associated
            challenge metadata as JSON. Authentication
            secrets and cryptographic key material are
            excluded from this download.
          </p>

          <a
            href="/api/privacy/export"
            className="mt-5 inline-block rounded-lg bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200"
          >
            Download My Data (JSON)
          </a>
        </section>


<section className="mt-6 rounded-xl border border-red-900/60 bg-gray-900 p-6">
  <h2 className="text-xl font-semibold text-red-400">
    Account Deletion
  </h2>

  <DeleteAccountButton />
</section>

      </div>
    </main>
  );
}


import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AddPasskeyButton from "./add-passkey-button";
import RemovePasskeyButton from "./remove-passkey-button";


import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export default async function PasskeysPage() {
  const cookieStore = await cookies();

  const sessionToken =
    cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  const session = await getSessionFromToken(
    sessionToken
  );

  if (!session) {
    redirect("/login");
  }

  const passkeys = await prisma.passkey.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">

        <Link
          href="/dashboard"
          className="text-gray-400 hover:text-white"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="text-4xl font-bold mt-8">
          Manage Passkeys
        </h1>

        <p className="text-gray-400 mt-3">
          View and manage passkeys connected to
          your account.
        </p>

        <div className="mt-10 bg-gray-900 border border-gray-800 rounded-xl p-6">

          <h2 className="text-xl font-semibold">
            Registered Passkeys
          </h2>

          <p className="text-gray-400 mt-2">
            You have {passkeys.length} registered
            passkey(s).
          </p>

         <AddPasskeyButton />

          {passkeys.length === 0 ? (
            <p className="mt-6 text-gray-400">
              No passkeys found.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="border border-gray-700 rounded-lg p-5"
                >
                  <h3 className="font-semibold">
                    Passkey
                  </h3>

                  <p className="text-sm text-gray-400 mt-2">
                    Credential ID: {passkey.id.slice(0, 12)}...
                  </p>

                  <p className="text-sm text-gray-400 mt-2">
                    Device Type: {passkey.deviceType}
                  </p>

                  <p className="text-sm text-gray-400 mt-2">
                    Backed Up: {passkey.backedUp ? "Yes" : "No"}
                  </p>

                  <p className="text-sm text-gray-400 mt-2">
                    Registered: {passkey.createdAt.toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>

<RemovePasskeyButton
  passkeyId={passkey.id}
  canRemove={passkeys.length > 1}
/>

                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

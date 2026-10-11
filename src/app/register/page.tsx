"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

export default function RegisterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegister() {
    try {
      setLoading(true);
      setMessage("");

      const optionsResponse = await fetch("/api/webauthn/register/options", {
        method: "POST",
      });

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(
          optionsData.error || "Could not generate registration options",
        );
      }

      const { options, userId } = optionsData;

      const registrationResponse = await startRegistration({
        optionsJSON: options,
      });

      const verifyResponse = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: registrationResponse,
          userId,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.verified) {
        throw new Error(verifyData.error || "Passkey verification failed");
      }

      setMessage("Passkey created successfully.");
      router.push("/dashboard");
    } catch (error) {
      console.error("Registration error:", error);

      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Unable to create passkey.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-7rem] top-[-4rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-5rem] bottom-0 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-[0_30px_80px_rgba(2,8,23,0.7)] backdrop-blur xl:grid-cols-[1fr_0.9fr]">
        <section className="hidden border-r border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(8,15,28,0))] p-10 xl:flex xl:flex-col xl:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-cyan-100"
            >
              ← Back to home
            </Link>

            <div className="mt-12 max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Create your account
              </p>
              <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight text-white">
                Start with a secure passkey-first identity.
              </h1>
              <p className="mt-6 text-base leading-8 text-slate-300">
                Register a pseudonymous account with no password fields and no
                email requirement in the application schema.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">Why this matters</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                This flow demonstrates modern authentication design using
                browser-supported passkeys and WebAuthn.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">Portfolio value</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                The goal is not only functionality, but a convincing,
                academically presentable software engineering prototype.
              </p>
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto w-full max-w-lg">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-cyan-100 xl:hidden"
            >
              ← Back to home
            </Link>

            <div className="mt-6 xl:mt-0">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Register
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Create account with passkey
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Your browser will prompt you to create a passkey using your
                device’s supported authenticator.
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <button
                onClick={handleRegister}
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_35px_rgba(34,211,238,0.22)] hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating passkey..." : "Create Account with Passkey"}
              </button>

              <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-4">
                <p className="text-sm text-slate-300">
                  No password required. No password is stored in the application
                  schema.
                </p>
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <p className="text-sm leading-7 text-slate-200">{message}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/login" className="hover:text-white">
                Already have an account? Log in
              </Link>
              <span className="text-slate-500">WebAuthn · Passkeys · Privacy-first</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
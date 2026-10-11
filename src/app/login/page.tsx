"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin() {
    try {
      setLoading(true);
      setMessage("Requesting login options...");

      const optionsResponse = await fetch("/api/webauthn/login/options", {
        method: "POST",
      });

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(optionsData.error || "Unable to create login options");
      }

      const { options, challengeId } = optionsData;

      setMessage("Waiting for your passkey...");

      const authenticationResponse = await startAuthentication({
        optionsJSON: options,
        useBrowserAutofill: false,
      });

      setMessage("Verifying passkey...");

      const verifyResponse = await fetch("/api/webauthn/login/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: authenticationResponse,
          challengeId,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.verified) {
        throw new Error(verifyData.error || "Passkey authentication failed");
      }

      setMessage("Login successful.");
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        setMessage(
          "Passkey sign-in was cancelled or could not be completed. Please try again.",
        );
      } else {
        console.error("Login error:", error);
        setMessage(
          error instanceof Error
            ? `Login error: ${error.message}`
            : "Unable to login with passkey.",
        );
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
                Welcome back
              </p>
              <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight text-white">
                Secure sign-in without passwords.
              </h1>
              <p className="mt-6 text-base leading-8 text-slate-300">
                Authenticate with your registered passkey and continue into the
                privacy dashboard.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">Simple flow</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Request options, use your passkey, verify the response, and
                enter the dashboard securely.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">Academic quality</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                This prototype is intended to communicate both practical
                implementation and design maturity.
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
                Login
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Sign in with your passkey
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Use your registered credential to access your dashboard securely
                without typing a password.
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_35px_rgba(34,211,238,0.22)] hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Login with Passkey"}
              </button>

              <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-4">
                <p className="text-sm text-slate-300">
                  Authentication is performed through WebAuthn using your saved
                  passkey.
                </p>
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <p className="text-sm leading-7 text-slate-200">{message}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/register" className="hover:text-white">
                Don&apos;t have an account? Create one
              </Link>
              <span className="text-slate-500">Secure sign-in · No password fields</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
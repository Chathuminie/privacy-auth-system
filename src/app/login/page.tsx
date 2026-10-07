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
    setMessage("Step 1: Requesting login options...");

    const optionsResponse = await fetch(
      "/api/webauthn/login/options",
      {
        method: "POST",
      }
    );

    setMessage("Step 2: Reading login options...");

    const optionsData = await optionsResponse.json();

    if (!optionsResponse.ok) {
      throw new Error(
        optionsData.error ||
          "Unable to create login options"
      );
    }

    const { options, challengeId } = optionsData;

    setMessage("Step 3: Waiting for your passkey...");

    const authenticationResponse =
      await startAuthentication({
        optionsJSON: options,
        useBrowserAutofill: false,
      });

    setMessage("Step 4: Verifying passkey...");

    const verifyResponse = await fetch(
      "/api/webauthn/login/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: authenticationResponse,
          challengeId,
        }),
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.verified) {
      throw new Error(
        verifyData.error ||
          "Passkey authentication failed"
      );
    }

    setMessage("Login successful.");

    router.push("/dashboard");
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof Error) {
      setMessage(`Login error: ${error.message}`);
    } else {
      setMessage("Unable to login with passkey.");
    }
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-md px-6">
        <h1 className="text-4xl font-bold text-center mb-3">
          Welcome Back
        </h1>

        <p className="text-gray-400 text-center mb-8">
          Sign in securely using your passkey.
        </p>

        <div className="border border-gray-800 rounded-xl p-6 bg-gray-900">
         <button
  type="button"
  onClick={handleLogin}
  className="w-full bg-white text-black py-3 rounded-lg font-semibold"
>
  Login with Passkey
</button>
          <p className="text-gray-500 text-sm text-center mt-4">
            No password required.
          </p>

         {message && (
  <p className="text-gray-300 text-sm text-center mt-4">
    {message}
  </p>
)}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/register"
            className="text-gray-400 hover:text-white"
          >
            Don't have an account? Create one
          </Link>
        </div>

        <div className="text-center mt-4">
          <Link
            href="/"
            className="text-gray-500 hover:text-white text-sm"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
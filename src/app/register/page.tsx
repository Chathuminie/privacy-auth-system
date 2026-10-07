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

      // STEP 1:
      // Ask our server to create WebAuthn registration options.
      const optionsResponse = await fetch(
        "/api/webauthn/register/options",
        {
          method: "POST",
        }
      );

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(
          optionsData.error ||
            "Could not generate registration options"
        );
      }

      const { options, userId } = optionsData;

      // STEP 2:
      // Ask Safari/macOS to create the passkey.
      const registrationResponse = await startRegistration({
        optionsJSON: options,
      });

      // STEP 3:
      // Send Safari's WebAuthn response back to our server.
      const verifyResponse = await fetch(
        "/api/webauthn/register/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: registrationResponse,
            userId,
          }),
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.verified) {
        throw new Error(
          verifyData.error || "Passkey verification failed"
        );
      }

      setMessage("Passkey created successfully!");

      // STEP 4:
      // Go to dashboard after successful registration.
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
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-md px-6">

        <h1 className="text-4xl font-bold text-center mb-3">
          Create Account
        </h1>

        <p className="text-gray-400 text-center mb-8">
          Create a privacy-preserving account using a passkey.
        </p>

        <div className="border border-gray-800 rounded-xl p-6 bg-gray-900">

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50"
          >
            {loading
              ? "Creating Passkey..."
              : "Create Account with Passkey"}
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
            href="/login"
            className="text-gray-400 hover:text-white"
          >
            Already have an account? Login
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
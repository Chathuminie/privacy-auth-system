"use client";
import Link from "next/link";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { AuthFrame } from "@/components/auth-frame";

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
    <AuthFrame variant="login">
      <p className="pa-kicker">Secure access</p>
      <h2>Sign in with a passkey</h2>
      <p>Confirm with your saved passkey to continue.</p>
      <div className="pa-auth-operation">
        <p className="pa-label" style={{ margin: "0 0 17px" }}>WebAuthn / Passkey</p>
        <button className="pa-button" type="button" onClick={handleLogin} disabled={loading}>
          {loading ? "Waiting for passkey…" : "Continue with passkey"} <span aria-hidden="true">↗</span>
        </button>
        <p className="pa-note">Your browser will ask you to verify.</p>
        {message && <p role="status" aria-live="polite" className="pa-auth-status">{message}</p>}
      </div>
      <div className="pa-auth-options">
        <Link href="/register" className="pa-button-link">Create an account →</Link>
        <span>No password required</span>
      </div>
    </AuthFrame>
  );
}

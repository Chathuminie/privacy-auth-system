"use client";
import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { AuthFrame } from "@/components/auth-frame";

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
    <AuthFrame variant="register">
      <p className="pa-kicker">Create an account</p>
      <h2>Register a passkey</h2>
      <p>No email, no password. Just a passkey.</p>
      <div className="pa-auth-operation">
        <p className="pa-label" style={{ margin: "0 0 17px" }}>WebAuthn / New credential</p>
        <button className="pa-button" type="button" onClick={handleRegister} disabled={loading}>
          {loading ? "Creating passkey…" : "Create a passkey"} <span aria-hidden="true">↗</span>
        </button>
        <p className="pa-note">Your device will ask you to confirm.</p>
        {message && <p role="status" aria-live="polite" className="pa-auth-status">{message}</p>}
      </div>
      <div className="pa-auth-options">
        <Link href="/login" className="pa-button-link">Already have a passkey? Sign in →</Link>
        <span>Private by design</span>
      </div>
    </AuthFrame>
  );
}

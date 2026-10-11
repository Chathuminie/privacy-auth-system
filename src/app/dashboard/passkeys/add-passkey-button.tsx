
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

export default function AddPasskeyButton() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAddPasskey() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      // Step 1: Request registration options.
      const optionsResponse = await fetch(
        "/api/webauthn/passkeys/add/options",
        {
          method: "POST",
          cache: "no-store",
        }
      );

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok) {
        throw new Error(
          optionsData.error || "Unable to create registration options"
        );
      }

      // Step 2: Ask Safari to register a passkey.
      const registrationResponse = await startRegistration({
        optionsJSON: optionsData.options,
      });

      // Step 3: Send the new credential to the server.
      const verifyResponse = await fetch(
        "/api/webauthn/passkeys/add/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: registrationResponse,
            challengeId: optionsData.challengeId,
          }),
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.verified) {
        throw new Error(
          verifyData.error || "Passkey verification failed"
        );
      }

      // Step 4: Show success and refresh the passkey list.
      setMessage("Passkey added successfully!");

      router.refresh();

} catch (error) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unable to add passkey.";

  if (/authenticator was previously registered/i.test(errorMessage)) {
    setMessage(
      "This authenticator already has a registered passkey. " +
      "Please choose a different passkey provider or security key."
    );
  } else {
    console.error("Add passkey error:", error);
    setMessage(errorMessage);
  }
} finally {
  setLoading(false);
}

  }

  return (
    <div className="">
      <button
        type="button"
        onClick={handleAddPasskey}
        disabled={loading}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#061421] shadow-[0_10px_30px_rgba(34,211,238,0.12)] hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Adding Passkey..." : "Add Another Passkey"}
      </button>

      {message && (
        <p
          role="status"
          className="mt-3 max-w-xs text-sm leading-6 text-teal-200"
        >
          {message}
        </p>
      )}
    </div>
  );
}

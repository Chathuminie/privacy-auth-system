
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
    <div className="mt-6">
      <button
        type="button"
        onClick={handleAddPasskey}
        disabled={loading}
        className="bg-white text-black px-5 py-3 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50"
      >
        {loading ? "Adding Passkey..." : "Add Another Passkey"}
      </button>

      {message && (
        <p
          role="status"
          className="mt-4 text-sm text-gray-300"
        >
          {message}
        </p>
      )}
    </div>
  );
}

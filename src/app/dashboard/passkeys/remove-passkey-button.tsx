
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

type RemovePasskeyButtonProps = {
  passkeyId: string;
  canRemove: boolean;
};

export default function RemovePasskeyButton({
  passkeyId,
  canRemove,
}: RemovePasskeyButtonProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function handleRemovePasskey() {
    if (!canRemove || loading) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this passkey? " +
        "You will no longer be able to use it to sign in. " +
        "You must verify your identity using Touch ID or a passkey."
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");
    setStatus("Preparing passkey verification...");

    try {
      // Step 1: Request a fresh removal challenge.
      const optionsResponse = await fetch(
        "/api/webauthn/passkeys/remove/options",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            passkeyId,
          }),
        }
      );

      const optionsData = await optionsResponse.json();

      if (
        !optionsResponse.ok ||
        !optionsData.options ||
        typeof optionsData.challengeId !== "string"
      ) {
        throw new Error(
          optionsData.error ||
            "Unable to start passkey verification"
        );
      }

      // Step 2: Authenticate with Touch ID or passkey.
      setStatus("Waiting for Touch ID or passkey...");

      const authenticationResponse =
        await startAuthentication({
          optionsJSON: optionsData.options,
        });

      // Step 3: Submit the signed authentication
      // response to securely remove the passkey.
      setStatus("Verifying and removing passkey...");

      const removeResponse = await fetch(
        "/api/webauthn/passkeys/remove",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            passkeyId,
            challengeId: optionsData.challengeId,
            response: authenticationResponse,
          }),
        }
      );

      const removeData = await removeResponse.json();

      if (!removeResponse.ok || !removeData.success) {
        throw new Error(
          removeData.error || "Unable to remove passkey"
        );
      }

      setMessage("Passkey removed successfully.");

      // Refresh the dashboard passkey list.
      router.refresh();
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "NotAllowedError" ||
          error.name === "AbortError")
      ) {
        setMessage(
          "Passkey verification was cancelled or timed out."
        );
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to remove passkey."
        );
      }
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleRemovePasskey}
        disabled={!canRemove || loading}
        className="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-400 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Verifying..." : "Remove Passkey"}
      </button>

      {!canRemove && (
        <p className="mt-2 text-sm text-gray-400">
          You cannot remove your last remaining passkey.
        </p>
      )}

      {status && (
        <p role="status" className="mt-2 text-sm text-blue-400">
          {status}
        </p>
      )}

      {message && (
        <p role="status" className="mt-2 text-sm text-gray-300">
          {message}
        </p>
      )}
    </div>
  );
}

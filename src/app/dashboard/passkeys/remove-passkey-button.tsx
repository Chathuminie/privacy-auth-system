
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  async function handleRemovePasskey() {
    if (!canRemove || loading) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this passkey? " +
      "You will no longer be able to use it to sign in."
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/webauthn/passkeys/remove",
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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to remove passkey"
        );
      }

      setMessage("Passkey removed successfully.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove passkey."
      );
    } finally {
      setLoading(false);
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
        {loading ? "Removing..." : "Remove Passkey"}
      </button>

      {!canRemove && (
        <p className="mt-2 text-sm text-gray-400">
          You cannot remove your last remaining passkey.
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


"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

export default function DeleteAccountButton() {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDelete() {
    if (loading || confirmation !== "DELETE") return;

    const confirmed = window.confirm(
      "WARNING: This permanently deletes your account, " +
        "registered passkeys, sessions, and related records. " +
        "This action cannot be undone. Continue?"
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("Preparing fresh passkey verification...");

    try {
      // Request a fresh account-deletion challenge.
      const optionsResponse = await fetch(
        "/api/privacy/delete/options",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
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
            "Unable to prepare account deletion"
        );
      }

      setMessage("Waiting for Touch ID or passkey...");

      // Require the user to authenticate again.
      const authenticationResponse =
        await startAuthentication({
          optionsJSON: optionsData.options,
        });

      setMessage("Verifying authentication...");

      // The backend verifies the signed response
      // before deleting the account.
      const deleteResponse = await fetch(
        "/api/privacy/delete",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            challengeId: optionsData.challengeId,
            response: authenticationResponse,
          }),
        }
      );

      const deleteData = await deleteResponse.json();

      if (!deleteResponse.ok || !deleteData.success) {
        throw new Error(
          deleteData.error || "Account deletion failed"
        );
      }

      // The backend has deleted the account and
      // cleared the authentication cookie.
      window.location.replace("/register");
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
            : "Unable to delete account."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5">
      <p className="text-sm text-red-300">
        Permanently delete your account, registered
        passkeys, sessions, and related database
        records. This action cannot be undone.
      </p>

      <p className="mt-3 text-sm text-gray-400">
        You must confirm your decision and complete
        fresh passkey verification.
      </p>

      <label
        htmlFor="delete-confirmation"
        className="mt-5 block text-sm text-gray-300"
      >
        Type <strong>DELETE</strong> to continue:
      </label>

      <input
        id="delete-confirmation"
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={confirmation}
        onChange={(event) =>
          setConfirmation(event.target.value)
        }
        disabled={loading}
        placeholder="DELETE"
        className="mt-2 w-full max-w-sm rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-red-500"
      />

      <div className="mt-4">
        <button
          type="button"
          onClick={handleDelete}
          disabled={confirmation !== "DELETE" || loading}
          className="rounded-lg border border-red-600 px-5 py-3 text-sm font-medium text-red-400 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading
            ? "Verifying..."
            : "Permanently Delete Account"}
        </button>
      </div>

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

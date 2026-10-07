import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center max-w-2xl px-6">
        <h1 className="text-5xl font-bold mb-6">
          Privacy Auth
        </h1>

        <p className="text-gray-400 text-lg mb-10">
          A privacy-preserving passwordless authentication system
          using WebAuthn and passkeys.
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/register"
            className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200"
          >
            Create Account
          </Link>

          <Link
            href="/login"
            className="border border-gray-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-800"
          >
            Login
          </Link>
        </div>

        <p className="mt-12 text-sm text-gray-500">
          No passwords. Minimal personal data. Secure authentication.
        </p>
      </div>
    </main>
  );
}
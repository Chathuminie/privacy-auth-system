import Link from "next/link";

export default function LoginPage() {
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
            className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-gray-200"
          >
            Login with Passkey
          </button>

          <p className="text-gray-500 text-sm text-center mt-4">
            No password required.
          </p>
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
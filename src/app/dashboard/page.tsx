import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">

        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold">
              Privacy Dashboard
            </h1>

            <p className="text-gray-400 mt-2">
              Manage your authentication and privacy settings.
            </p>
          </div>

          <Link
            href="/"
            className="border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Logout
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">
              Authentication
            </h2>

            <p className="text-gray-400">
              You are securely authenticated using a passkey.
            </p>

            <p className="text-green-400 mt-4">
              ● Secure
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">
              Passkeys
            </h2>

            <p className="text-gray-400">
              Manage devices and passkeys connected to your account.
            </p>

            <button className="mt-4 text-sm border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-800">
              Manage Passkeys
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">
              Privacy
            </h2>

            <p className="text-gray-400">
              View and manage the data stored about your account.
            </p>

            <button className="mt-4 text-sm border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-800">
              Privacy Settings
            </button>
          </div>

        </div>

        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">
            Account Information
          </h2>

          <div className="space-y-3 text-gray-400">
            <p>
              User ID:
              <span className="text-white ml-2">
                Not generated yet
              </span>
            </p>

            <p>
              Authentication method:
              <span className="text-white ml-2">
                Passkey / WebAuthn
              </span>
            </p>

            <p>
              Password stored:
              <span className="text-green-400 ml-2">
                No
              </span>
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
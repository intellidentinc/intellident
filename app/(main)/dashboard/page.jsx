import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <nav className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-blue-600">Dashboard</h1>
            <SignOutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Welcome back{session.name ? `, ${session.name}` : ""}!
            </h2>
            <p className="text-gray-600">Email: {session.email}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Account Info
              </h3>
              <p className="text-sm text-gray-600">User ID: {session.userId}</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Status
              </h3>
              <p className="text-sm text-green-600 font-semibold">Active</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Quick Actions
              </h3>
              <p className="text-sm text-gray-600">Coming soon...</p>
            </div>
          </div>

          <div className="mt-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <h3 className="text-xl font-semibold mb-2">Getting Started</h3>
            <p className="text-blue-100">
              Your authentication system is now set up! You can customize this
              dashboard to fit your needs.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

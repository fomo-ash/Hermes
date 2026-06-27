"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/use-auth"; // Explicit relative path matching your tree

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && user && !user.onboarded) {
      router.push("/onboarding");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400 bg-slate-950 font-sans">
        <p className="animate-pulse">Verifying secure session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.name}
                className="w-12 h-12 rounded-full border border-slate-700"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-sm font-semibold rounded-md transition-colors"
          >
            Sign Out
          </button>
        </header>

        <main className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <p className="text-slate-300">
            Your custom dashboard metrics and views belong here.
          </p>
        </main>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";

import DashboardSidebar from "@/components/Dashboard/Sidebar";

import { getCurrentUser } from "@/lib/firebase/session";
import { getCurrentUserProfile } from "@/lib/users/users";

import ProfileForm from "@/components/profile/ProfileForm";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentUserProfile(user);

  if (!profile) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#080b08] text-zinc-100">
      <DashboardSidebar user={user} profile={profile} />

      <div className="min-h-screen pl-20 lg:pl-64">
        {/* HEADER */}
        <header className="border-b border-zinc-800 bg-[#080b08]">
          <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
            <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
              Account
            </p>

            <h1 className="mt-3 font-body text-4xl font-bold uppercase tracking-tight text-white sm:text-5xl">
              Profile
            </h1>

            <p className="mt-3 max-w-2xl font-body text-sm font-medium leading-6 text-zinc-500">
              Manage your personal information and account details.
            </p>
          </div>
        </header>

        {/* CONTENT */}
        <section className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            {/* PROFILE OVERVIEW */}
            <div className="rounded-2xl border border-lime-400/20 bg-[#0c110b] p-6 shadow-[0_0_25px_rgba(163,255,0,0.04)]">
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-lime-400">
                Your account
              </p>

              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-lime-400 font-body text-2xl font-bold uppercase text-[#080b08]">
                  {(profile.displayName || profile.email || "W")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate font-body text-xl font-bold text-white">
                    {profile.displayName || "Watch Party User"}
                  </h2>

                  <p className="mt-1 truncate font-body text-sm font-medium text-zinc-500">
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4 border-t border-zinc-800 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-body text-sm font-medium text-zinc-500">
                    Account type
                  </span>

                  <span className="rounded-full border border-lime-400/30 bg-lime-400/5 px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-lime-400">
                    {profile.user_type}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="font-body text-sm font-medium text-zinc-500">
                    Provider
                  </span>

                  <span className="font-body text-sm font-semibold capitalize text-zinc-300">
                    {profile.provider || "Unknown"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="font-body text-sm font-medium text-zinc-500">
                    Member since
                  </span>

                  <span className="font-body text-sm font-semibold text-zinc-300">
                    {formatDate(profile.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* PERSONAL INFORMATION */}
            <div className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 lg:p-8">
              <div className="mb-7">
                <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-lime-400">
                  Personal information
                </p>

                <h2 className="mt-2 font-body text-2xl font-bold text-white">
                  Account details
                </h2>

                <p className="mt-2 font-body text-sm font-medium leading-6 text-zinc-500">
                  Update the information associated with your Watch Party
                  account.
                </p>
              </div>

              <ProfileForm profile={profile} />
            </div>
          </div>

          {/* ACCOUNT INFORMATION */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 lg:p-8">
            <div className="mb-6">
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-lime-400">
                Account
              </p>

              <h2 className="mt-2 font-body text-2xl font-bold text-white">
                Account information
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-[#101810] p-4">
                <p className="font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-600">
                  Email
                </p>

                <p className="mt-2 break-all font-body text-sm font-semibold text-zinc-300">
                  {profile.email || "Not available"}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#101810] p-4">
                <p className="font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-600">
                  Last access
                </p>

                <p className="mt-2 font-body text-sm font-semibold text-zinc-300">
                  {formatDate(profile.lastLoginAt)}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#101810] p-4">
                <p className="font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-600">
                  Account status
                </p>

                <p className="mt-2 font-body text-sm font-semibold text-lime-400">
                  Active
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

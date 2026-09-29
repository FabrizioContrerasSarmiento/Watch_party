import Link from "next/link";
import { redirect } from "next/navigation";

import DashboardSidebar from "@/components/Dashboard/Sidebar";
import UserForm from "@/components/users/UserForm";

import { getCurrentUser } from "@/lib/firebase/session";
import { getCurrentUserProfile, listUserProfiles } from "@/lib/users/users";

import { createUser, deleteUser } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function UsersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentUserProfile(user);

  if (profile?.user_type !== "admin") {
    redirect("/dashboard");
  }

  const users = await listUserProfiles();

  return (
    <main className="min-h-screen bg-[#080b08] text-zinc-100">
      <DashboardSidebar user={user} profile={profile} />

      <div className="min-h-screen pl-0 lg:pl-64">
        {/* HEADER */}
        <header className="border-b border-zinc-800 bg-[#080b08]">
          <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
                Administration
              </p>

              <h1 className="mt-3 font-body text-4xl font-bold uppercase tracking-tight text-white sm:text-5xl">
                User Management
              </h1>

              <p className="mt-3 max-w-2xl font-body text-sm font-medium leading-6 text-zinc-500">
                Manage registered users and their profiles from one place.
              </p>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <section className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            {/* CREATE USER */}
            <div className="rounded-2xl border border-lime-400/20 bg-[#0c110b] p-6 shadow-[0_0_25px_rgba(163,255,0,0.04)]">
              <div className="mb-6">
                <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-lime-400">
                  New account
                </p>

                <h2 className="mt-2 font-body text-2xl font-bold text-white">
                  Create User
                </h2>

                <p className="mt-2 font-body text-sm font-medium leading-6 text-zinc-500">
                  Add a new user to the platform.
                </p>
              </div>

              <UserForm
                action={createUser}
                showCredentials
                submitLabel="Create user"
              />
            </div>

            {/* USERS */}
            <div>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-lime-400">
                    Registered accounts
                  </p>

                  <h2 className="mt-2 font-body text-2xl font-bold text-white">
                    Users
                  </h2>
                </div>

                <span className="font-body text-sm font-semibold text-zinc-500">
                  {users.length} total
                </span>
              </div>

              {users.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-8 font-body text-sm font-medium leading-6 text-zinc-500">
                  No registered users found.
                </div>
              ) : (
                <div className="grid gap-4">
                  {users.map((managedUser) => (
                    <article
                      className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-5 transition-all duration-300 hover:border-lime-400/30 hover:shadow-[0_0_25px_rgba(163,255,0,0.05)]"
                      key={managedUser.uid}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        {/* USER INFO */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="break-all font-body text-base font-bold text-white">
                              {managedUser.email || managedUser.uid}
                            </h3>

                            <span className="rounded-full border border-lime-400/30 bg-lime-400/5 px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-lime-400">
                              {managedUser.user_type}
                            </span>
                          </div>

                          {managedUser.displayName ? (
                            <p className="mt-2 font-body text-sm font-medium text-zinc-400">
                              {managedUser.displayName}
                            </p>
                          ) : null}

                          <p className="mt-3 break-all font-body text-xs font-medium text-zinc-600">
                            UID: {managedUser.uid}
                          </p>

                          <p className="mt-2 font-body text-xs font-medium text-zinc-600">
                            Last access: {formatDate(managedUser.lastLoginAt)}
                          </p>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Link
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-700 px-4 font-body text-sm font-bold text-zinc-200 transition hover:border-lime-400/50 hover:bg-lime-400/5 hover:text-lime-400"
                            href={`/dashboard/users/${managedUser.uid}/edit`}
                          >
                            Edit
                          </Link>

                          {managedUser.uid !== user.uid ? (
                            <form
                              action={deleteUser.bind(null, managedUser.uid)}
                            >
                              <button
                                className="h-10 w-full rounded-xl border border-red-900/70 px-4 font-body text-sm font-bold text-red-400 transition hover:bg-red-950/30 sm:w-auto"
                                type="submit"
                              >
                                Delete
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import DashboardSidebar from "@/components/Dashboard/Sidebar";
import UserForm from "@/components/users/UserForm";

import { getCurrentUser } from "@/lib/firebase/session";
import { getCurrentUserProfile, getUserProfile } from "@/lib/users/users";

import { updateUser } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const currentProfile = await getCurrentUserProfile(currentUser);

  if (currentProfile?.user_type !== "admin") {
    redirect("/dashboard");
  }

  const { uid } = await params;

  const managedUser = await getUserProfile(uid);

  if (!managedUser) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#080b08] text-white">
      {/* SIDEBAR */}
      <DashboardSidebar user={currentUser} profile={currentProfile} />

      {/* CONTENT */}
      <div className="min-h-screen pl-20 lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
          {/* HEADER */}
          <header className="border-b border-zinc-800 pb-8">
            <Link
              href="/dashboard/users"
              className="font-body text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 transition hover:text-lime-400"
            >
              ← Administration
            </Link>

            <div className="mt-6">
              <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
                User management
              </p>

              <h1 className="mt-3 font-body text-4xl font-bold uppercase tracking-tight text-white sm:text-5xl">
                Edit User
              </h1>

              <p className="mt-3 max-w-2xl font-body text-sm font-medium leading-6 text-zinc-500">
                Update the account information and permissions for this user.
              </p>
            </div>
          </header>

          {/* USER HEADER CARD */}
          <section className="mt-8 rounded-2xl border border-lime-400/20 bg-[#0c110b] p-6 shadow-[0_0_25px_rgba(163,255,0,0.04)] sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {/* AVATAR */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-lime-400 font-body text-2xl font-bold uppercase text-[#080b08]">
                {(managedUser.displayName || managedUser.email || "W")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              {/* INFO */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="break-all font-body text-xl font-bold text-white">
                    {managedUser.displayName || "Unnamed user"}
                  </h2>

                  <span className="rounded-full border border-lime-400/30 bg-lime-400/5 px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-lime-400">
                    {managedUser.user_type}
                  </span>
                </div>

                <p className="mt-1 break-all font-body text-sm font-medium text-zinc-500">
                  {managedUser.email || "No email"}
                </p>
              </div>
            </div>
          </section>

          {/* EDIT FORM */}
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 sm:p-8">
            <div className="mb-7">
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-lime-400">
                Account details
              </p>

              <h2 className="mt-2 font-body text-2xl font-bold text-white">
                Personal information
              </h2>

              <p className="mt-2 font-body text-sm font-medium leading-6 text-zinc-500">
                Modify the information associated with this account.
              </p>
            </div>

            <UserForm
              action={updateUser.bind(null, managedUser.uid)}
              user={managedUser}
              submitLabel="Save changes"
            />
          </section>

          {/* ACCOUNT INFORMATION */}
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 sm:p-8">
            <div className="mb-6">
              <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-lime-400">
                System information
              </p>

              <h2 className="mt-2 font-body text-2xl font-bold text-white">
                Account details
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-[#101810] p-4">
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                  User ID
                </p>

                <p className="mt-2 break-all font-mono text-xs font-medium text-zinc-400">
                  {managedUser.uid}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#101810] p-4">
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                  Authentication
                </p>

                <p className="mt-2 font-body text-sm font-semibold capitalize text-zinc-300">
                  {managedUser.provider || "Unknown"}
                </p>
              </div>
            </div>
          </section>

          {/* BACK */}
          <div className="mt-6">
            <Link
              href="/dashboard/users"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-800 px-5 font-body text-sm font-bold text-zinc-400 transition hover:border-lime-400/40 hover:bg-[#101810] hover:text-lime-400"
            >
              ← Back to Administration
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

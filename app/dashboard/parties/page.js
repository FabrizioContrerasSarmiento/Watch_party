import { redirect } from "next/navigation";
import Link from "next/link";
import { IoAdd, IoArrowForward } from "react-icons/io5";
import DashboardSidebar from "@/components/Dashboard/Sidebar";
import JoinByCodeModal from "@/components/JoinByCodeModal";
import PartiesList from "@/components/parties/PartiesList";
import { getCurrentUser } from "@/lib/firebase/session";
import { getCurrentUserProfile } from "@/lib/users/users";
import { listUserParties } from "@/lib/parties/parties";

export const dynamic = "force-dynamic";

export default async function PartiesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentUserProfile(user);
  const parties = await listUserParties(user.uid);

  return (
    <div className="min-h-screen bg-[#080b08] text-white">
      <DashboardSidebar user={user} profile={profile} />

      <main className="pl-20 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-6 pb-10 pt-8 lg:px-10 lg:pt-10">
          {/* HEADER */}
          <header className="flex flex-col gap-6 border-b border-zinc-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.25em] text-lime-400">
                Watch Party
              </p>

              <h1 className="mt-3 font-body text-4xl font-bold uppercase leading-none text-white sm:text-5xl">
                My Parties
              </h1>

              <p className="mt-4 max-w-xl font-body text-sm font-medium leading-6 text-zinc-400">
                Manage your watch rooms and jump back into a session.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/parties/new"
                className="group inline-flex h-12 w-full items-center justify-center gap-3 rounded-md bg-lime-400 px-6 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#080b08] transition-all duration-300 hover:bg-lime-300 hover:shadow-[0_0_30px_rgba(163,255,0,0.18)] active:scale-95 sm:w-auto"
              >
                <IoAdd className="text-xl" />
                <span>Create Watch Party</span>
              </Link>

              <JoinByCodeModal triggerClassName="group inline-flex h-12 w-full items-center justify-center gap-3 rounded-md border border-lime-400/40 bg-lime-400/10 px-6 font-body text-xs font-bold uppercase tracking-[0.08em] text-lime-400 transition-all duration-300 hover:border-lime-400 hover:bg-lime-400 hover:text-[#080b08] hover:shadow-[0_0_30px_rgba(163,255,0,0.18)] active:scale-95 sm:w-auto">
                <IoArrowForward className="text-lg transition-transform duration-300 group-hover:translate-x-0.5" />
                <span>Unirse con código</span>
              </JoinByCodeModal>
            </div>
          </header>

          {/* PARTIES LIST */}
          <PartiesList initialParties={parties} currentUserId={user.uid} />
        </div>
      </main>
    </div>
  );
}

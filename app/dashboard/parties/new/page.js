import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardSidebar from "@/components/Dashboard/Sidebar";
import { getCurrentUser } from "@/lib/firebase/session";
import PartyForm from "@/components/parties/PartyForm";

export const dynamic = "force-dynamic";

export default async function NewPartyPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#080b08] text-white">
      <DashboardSidebar />

      <main className="pl-20 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/dashboard/parties"
              className="mb-5 inline-flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-lime-400"
            >
              ← Back to My Parties
            </Link>

            <p className="font-body text-xs font-bold uppercase tracking-[0.25em] text-lime-400">
              Watch Party
            </p>

            <h1 className="mt-3 font-body text-4xl font-bold uppercase leading-none text-white sm:text-5xl">
              Create Party
            </h1>

            <p className="mt-4 max-w-2xl font-body text-sm font-medium leading-6 text-zinc-400">
              Create a room, choose your video and invite your friends to watch
              together in real time.
            </p>
          </div>

          {/* Form */}
          <PartyForm />
        </div>
      </main>
    </div>
  );
}

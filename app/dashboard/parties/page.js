import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { IoIosTv } from "react-icons/io";
import {
  IoAdd,
  IoPlay,
  IoPeople,
  IoTimeOutline,
  IoArrowForward,
  IoVideocamOutline,
} from "react-icons/io5";
import DashboardSidebar from "@/components/Dashboard/Sidebar";
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

            <Link
              href="/dashboard/parties/new"
              className="group inline-flex h-12 items-center justify-center gap-3 rounded-md bg-lime-400 px-6 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#080b08] transition-all duration-300 hover:bg-lime-300 hover:shadow-[0_0_30px_rgba(163,255,0,0.18)]"
            >
              <IoAdd className="text-xl" />
              Create Watch Party
            </Link>
          </header>

          {/* SUMMARY */}
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<IoVideocamOutline />}
              label="Total Parties"
              value={parties.length}
            />

            <SummaryCard
              icon={<IoPeople />}
              label="Your Rooms"
              value={parties.length}
            />
          </section>

          {/* PARTIES */}
          <section className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-body text-lg font-bold uppercase text-white">
                  Your Watch Parties
                </h2>

                <p className="mt-1 font-body text-xs font-medium text-zinc-500">
                  {parties.length} {parties.length === 1 ? "party" : "parties"}{" "}
                  created
                </p>
              </div>
            </div>

            {parties.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {parties.map((party) => (
                  <PartyCard key={party.id} party={party} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------- */
/* SUMMARY CARD */
/* -------------------------------- */

function SummaryCard({ icon, label, value }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-5 transition-all duration-300 hover:border-lime-400/20">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-lime-400/20 bg-lime-400/5 text-xl text-lime-400">
          {icon}
        </div>

        <span className="font-body text-2xl font-bold text-white">{value}</span>
      </div>

      <p className="mt-5 font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
    </article>
  );
}

/* -------------------------------- */
/* PARTY CARD */
/* -------------------------------- */

function PartyCard({ party }) {
  const isActive = party.status === "active";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] transition-all duration-300 hover:-translate-y-1 hover:border-lime-400/30 hover:shadow-[0_0_35px_rgba(163,255,0,0.06)]">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-lime-400/5 blur-3xl transition-all duration-500 group-hover:bg-lime-400/10" />

      <div className="relative z-10 p-6">
        {/* TOP */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/5 text-xl text-lime-400">
              <IoVideocamOutline />
            </div>

            <div>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Watch Party
              </p>

              <h3 className="mt-1 line-clamp-1 font-body text-base font-bold text-white">
                {party.title || "Untitled Party"}
              </h3>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full border px-3 py-1 font-body text-[9px] font-bold uppercase tracking-[0.15em] ${
              isActive
                ? "border-lime-400/30 bg-lime-400/5 text-lime-400"
                : "border-zinc-700 bg-zinc-800/50 text-zinc-500"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* DESCRIPTION */}
        <p className="mt-6 min-h-[40px] line-clamp-2 font-body text-sm font-medium leading-5 text-zinc-400">
          {party.description || "No description added for this party."}
        </p>

        {/* ROOM CODE */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-[#101a0b] px-4 py-3">
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            Room Code
          </p>

          <p className="mt-1 font-mono text-sm font-bold tracking-wider text-lime-400">
            {party.roomCode || "—"}
          </p>
        </div>

        {/* INFO */}
        <div className="mt-5 flex items-center gap-5 text-zinc-500">
          <div className="flex items-center gap-2">
            <IoVideocamOutline className="text-sm" />
            <span className="font-body text-xs font-semibold">YouTube</span>
          </div>

          <div className="flex items-center gap-2">
            <IoTimeOutline className="text-sm" />
            <span className="font-body text-xs font-semibold">
              {formatDate(party.createdAt)}
            </span>
          </div>
        </div>

        {/* ACTION */}
        <Link
          href={`/watch-party/${party.roomCode}`}
          className="group/button mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-lime-400/30 bg-lime-400/5 font-body text-xs font-bold uppercase tracking-[0.08em] text-lime-400 transition-all duration-300 hover:bg-lime-400 hover:text-[#080b08]"
        >
          Open Party
          <IoArrowForward className="text-lg transition-transform duration-300 group-hover/button:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}

/* -------------------------------- */
/* EMPTY STATE */
/* -------------------------------- */

function EmptyState() {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] px-6 py-16 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/5 blur-[100px]" />

      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5 text-3xl text-lime-400">
          <IoIosTv />
        </div>

        <h3 className="mt-6 font-body text-xl font-bold uppercase text-white">
          No parties yet
        </h3>

        <p className="mt-3 font-body text-sm font-medium leading-6 text-zinc-500">
          Create your first Watch Party and start watching together.
        </p>

        <Link
          href="/dashboard/parties/new"
          className="mt-7 inline-flex h-11 items-center justify-center gap-3 rounded-md bg-lime-400 px-6 font-body text-xs font-bold uppercase text-[#080b08] transition-all hover:bg-lime-300"
        >
          <IoAdd className="text-lg" />
          Create Watch Party
        </Link>
      </div>
    </article>
  );
}

/* -------------------------------- */
/* HELPERS */
/* -------------------------------- */

function formatDate(date) {
  if (!date) return "Recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

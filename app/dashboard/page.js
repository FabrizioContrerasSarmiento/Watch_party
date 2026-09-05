import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import DashboardSidebar from "@/components/Dashboard/Sidebar";

import { getCurrentUser } from "@/lib/firebase/session";
import { listUserParties } from "@/lib/parties/parties";
import { getCurrentUserProfile, listUserProfiles } from "@/lib/users/users";
import { BiSolidVideos } from "react-icons/bi";
import { GiTicket } from "react-icons/gi";
import { CgEditBlackPoint } from "react-icons/cg";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const parties = await listUserParties(user.uid);
  const profile = await getCurrentUserProfile(user);

  const isAdmin = profile?.user_type === "admin";
  const users = isAdmin ? await listUserProfiles() : [];

  return (
    <main className="min-h-screen bg-[#080b08] text-white">
      {/* SIDEBAR */}
      <DashboardSidebar user={user} profile={profile} />

      {/* CONTENT */}
      <div className="min-h-screen pl-20 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-6 pb-10 lg:px-10">
          {/* BANNER */}
          <section className="relative w-full overflow-hidden">
            <div className="relative aspect-[16/6] w-full">
              <Image
                src="/items/party.png"
                alt="Watch Party"
                fill
                priority
                className="object-cover"
              />

              {/* Degradado izquierdo */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#080b08]/80 via-[#080b08]/5 to-transparent" />

              {/* Degradado inferior */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#080b08]/20 via-transparent to-transparent" />

              {/* Texto */}
              <div className="absolute inset-0 flex flex-col justify-center px-5 lg:px-8">
                <p className="font-body text-xs font-bold uppercase tracking-[0.25em] text-lime-400">
                  Watch Party
                </p>

                <h1 className="mt-4 font-body text-5xl font-bold uppercase leading-[0.9] text-white sm:text-6xl lg:text-7xl">
                  Dashboard
                </h1>

                <p className="mt-5 max-w-xs font-body text-base font-semibold leading-7 text-white">
                  Welcome back,{" "}
                  <span className="font-bold text-lime-500">
                    {profile?.displayName || "User"}
                  </span>
                  . Ready to watch something together?
                </p>
              </div>
            </div>
          </section>

          {/* QUICK STATS */}
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* YOUR PARTIES */}
            <article className="group relative overflow-hidden border border-lime-400/20 bg-[#0c110b] transition-all duration-300 hover:border-lime-400/50">
              {/* Perforaciones */}
              <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#080b07]" />
              <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#080b07]" />

              <div className="grid min-h-[190px] grid-cols-[1fr_78px]">
                {/* Ticket principal */}
                <div className="flex flex-col justify-between p-6 pr-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        <BiSolidVideos />
                      </span>
                      <span className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-lime-400">
                        Your Parties
                      </span>
                    </div>

                    <strong className="mt-5 block font-body text-5xl font-bold tracking-tight text-white">
                      {parties.length}
                    </strong>

                    <p className="mt-1 font-body text-xs font-medium uppercase tracking-wider text-zinc-600">
                      Watch Parties created by you
                    </p>
                  </div>

                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-700">
                    WATCH PARTY · ADMIT ONE
                  </span>
                </div>

                {/* Talón */}
                <div className="relative flex flex-col items-center justify-center border-l border-dashed border-zinc-700 px-3">
                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 [writing-mode:vertical-rl]">
                    YOUR PARTIES
                  </span>

                  <span className="mt-4 font-mono text-[10px] text-lime-400/60">
                    #{String(parties.length).padStart(3, "0")}
                  </span>
                </div>
              </div>
            </article>

            {/* ACCOUNT */}
            <article className="group relative overflow-hidden border border-zinc-800 bg-[#0c110b] transition-all duration-300 hover:border-lime-400/40">
              {/* Perforaciones */}
              <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#080b07]" />
              <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#080b07]" />

              <div className="grid min-h-[190px] grid-cols-[1fr_78px]">
                <div className="flex flex-col justify-between p-6 pr-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        <GiTicket />
                      </span>
                      <span className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Account
                      </span>
                    </div>

                    <strong className="mt-6 block font-body text-2xl font-bold uppercase tracking-wide text-lime-400">
                      {profile?.user_type || "user"}
                    </strong>

                    <p className="mt-2 font-body text-xs font-medium uppercase tracking-wider text-zinc-600">
                      Your current account role
                    </p>
                  </div>

                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-700">
                    MEMBER PASS · 001
                  </span>
                </div>

                <div className="relative flex flex-col items-center justify-center border-l border-dashed border-zinc-700 px-3">
                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 [writing-mode:vertical-rl]">
                    ACCOUNT
                  </span>

                  <span className="mt-4 font-mono text-[10px] text-zinc-600">
                    USER
                  </span>
                </div>
              </div>
            </article>

            {/* ACCOUNT STATUS */}
            <article className="group relative overflow-hidden border border-zinc-800 bg-[#0c110b] transition-all duration-300 hover:border-lime-400/40">
              {/* Perforaciones */}
              <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#080b07]" />
              <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#080b07]" />

              <div className="grid min-h-[190px] grid-cols-[1fr_78px]">
                <div className="flex flex-col justify-between p-6 pr-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        <CgEditBlackPoint />
                      </span>
                      <span className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Account Status
                      </span>
                    </div>

                    <strong className="mt-6 block font-body text-2xl font-bold uppercase tracking-wide text-lime-400">
                      Active
                    </strong>

                    <p className="mt-2 truncate font-body text-xs font-medium text-zinc-600">
                      {user.email}
                    </p>
                  </div>

                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-700">
                    VERIFIED · ADMIT ONE
                  </span>
                </div>

                <div className="relative flex flex-col items-center justify-center border-l border-dashed border-zinc-700 px-3">
                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 [writing-mode:vertical-rl]">
                    STATUS
                  </span>

                  <span className="mt-4 h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.6)]" />
                </div>
              </div>
            </article>
          </section>

          {/* CREATE PARTY */}
          <section className="mt-6">
            <article className="relative overflow-hidden bg-[#0c110b]">
              {/* HUD FRAME */}
              <div className="pointer-events-none absolute inset-0">
                {/* Marco principal */}
                <div
                  className="absolute inset-0 border-2 border-lime-400/70"
                  style={{
                    clipPath:
                      "polygon(0 14px, 14px 14px, 14px 4px, 88% 4px, 88% 12px, 96% 12px, 100% 30px, 100% 82%, 94% 82%, 94% 94%, 12% 94%, 12% 88%, 4% 88%, 0 72%)",
                  }}
                />

                {/* Línea superior */}
                <div className="absolute left-8 right-20 top-2 h-px bg-lime-400/60" />

                {/* Línea inferior */}
                <div className="absolute bottom-3 left-16 right-10 h-px bg-lime-400/40" />

                {/* Detalle superior izquierdo */}
                <div className="absolute left-5 top-1 h-[3px] w-24 bg-lime-400" />
                <div className="absolute left-5 top-5 h-px w-32 bg-lime-400/40" />

                {/* Detalle inferior derecho */}
                <div className="absolute bottom-4 right-8 flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className="h-[3px] w-1 bg-lime-400/50" />
                  ))}
                </div>

                {/* Glow */}
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime-400/10 blur-[80px]" />
              </div>

              {/* CONTENT */}
              <div className="relative z-10 px-7 py-8 lg:px-10 lg:py-9">
                {/* Header */}
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    {/* System label */}
                    <div className="mb-3 flex items-center gap-3">
                      <span className="h-2 w-2 bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.8)]" />

                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-lime-400">
                        New Session
                      </span>

                      <span className="font-mono text-[9px] uppercase tracking-widest text-lime-400/30">
                        // PARTY_PROTOCOL
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="font-body text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
                      Create a Watch Party
                    </h2>

                    {/* Description */}
                    <p className="mt-3 max-w-xl font-body text-sm font-medium leading-6 text-zinc-500">
                      Create a private room, add a YouTube video and invite your
                      friends to watch together in real time.
                    </p>
                  </div>

                  {/* CTA */}
                  <Link
                    href="/dashboard/parties/new"
                    className="group relative flex h-14 shrink-0 items-center justify-center overflow-hidden border border-lime-400 bg-lime-400 px-7 font-body text-sm font-bold uppercase tracking-wider text-[#080b08] transition-all duration-300 hover:bg-lime-300 hover:shadow-[0_0_30px_rgba(163,255,0,0.2)]"
                    style={{
                      clipPath:
                        "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                    }}
                  >
                    <span className="relative z-10">+ Create Watch Party</span>

                    {/* Hover scan */}
                    <span className="absolute inset-x-0 top-0 h-px bg-white/70 opacity-0 transition-all duration-300 group-hover:opacity-100" />
                  </Link>
                </div>

                {/* Bottom technical line */}
                <div className="mt-7 flex items-center gap-3">
                  <span className="h-px flex-1 bg-lime-400/10" />

                  <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-lime-400/30">
                    SYSTEM READY
                  </span>

                  <span className="h-px w-16 bg-lime-400/20" />
                </div>
              </div>
            </article>
          </section>

          {/* RECENT PARTIES */}
          <section className="mt-6">
            <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] p-7">
              {/* DECORACIÓN */}
              <div className="pointer-events-none absolute right-[-20px] top-1/2 z-0 -translate-y-1/2">
                <Image
                  src="/items/film.png"
                  alt=""
                  width={360}
                  height={360}
                  className="w-[360px] opacity-20 drop-shadow-[0_0_40px_rgba(163,255,0,0.4)]"
                />
              </div>

              {/* DEGRADADO SOBRE LA DECORACIÓN */}
              <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-2/3 bg-gradient-to-r from-[#0c110b] via-[#0c110b]/70 to-transparent" />

              {/* CONTENIDO */}
              <div className="relative z-10">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="font-body text-xs font-bold uppercase tracking-[0.15em] text-lime-400">
                      Your activity
                    </span>

                    <h2 className="mt-3 font-body text-2xl font-bold uppercase text-white">
                      Recent Parties
                    </h2>
                  </div>

                  <Link
                    href="/dashboard/parties"
                    className="font-body text-xs font-bold uppercase tracking-[0.1em] text-zinc-500 transition hover:text-lime-400"
                  >
                    View all
                  </Link>
                </div>

                <div className="mt-6 max-w-3xl">
                  {parties.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-[#101810]/90 p-6">
                      <p className="font-body text-sm font-medium text-zinc-500">
                        You haven't created any Watch Parties yet.
                      </p>

                      <Link
                        href="/dashboard/parties/new"
                        className="mt-4 inline-flex font-body text-sm font-bold text-lime-400 transition hover:text-lime-300"
                      >
                        Create your first party →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {parties.slice(0, 5).map((party) => (
                        <div
                          key={party.id}
                          className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-[#101810]/90 p-4 transition hover:border-lime-400/30 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <h3 className="truncate font-body text-sm font-bold text-white">
                              {party.title}
                            </h3>

                            <p className="mt-1 font-body text-xs font-medium text-zinc-600">
                              Room code: {party.roomCode}
                            </p>
                          </div>

                          <Link
                            href={`/dashboard/parties/${party.id}`}
                            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 px-4 font-body text-xs font-bold text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-400"
                          >
                            Open
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          </section>

          {/* ADMINISTRATION */}
          {isAdmin ? (
            <section className="mt-6">
              <article className="rounded-2xl border border-zinc-800 bg-[#0c110b] p-7">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <span className="font-body text-xs font-bold uppercase tracking-[0.15em] text-lime-400">
                      Administration
                    </span>

                    <h2 className="mt-3 font-body text-2xl font-bold uppercase text-white">
                      Platform Users
                    </h2>

                    <p className="mt-2 max-w-2xl font-body text-sm font-medium leading-6 text-zinc-500">
                      Manage the users registered on the Watch Party platform.
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <strong className="font-body text-4xl font-bold text-white">
                      {users.length}
                    </strong>

                    <Link
                      href="/dashboard/users"
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-lime-400/50 px-5 font-body text-sm font-bold text-lime-400 transition-all duration-300 hover:bg-lime-400 hover:text-[#080b08]"
                    >
                      Manage users
                    </Link>
                  </div>
                </div>
              </article>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

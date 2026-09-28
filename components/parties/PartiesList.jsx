"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  IoVideocamOutline,
  IoPeople,
  IoTimeOutline,
  IoArrowForward,
  IoEllipsisHorizontal,
  IoCopyOutline,
  IoTrashOutline,
  IoCheckmark,
  IoAlertCircleOutline,
  IoAdd,
} from "react-icons/io5";
import { IoIosTv } from "react-icons/io";
import { deleteWatchPartyAction } from "@/app/watch-party/actions";

export default function PartiesList({ initialParties = [], currentUserId = "" }) {
  const [parties, setParties] = useState(initialParties);
  const [partyToDelete, setPartyToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [toast, setToast] = useState(null);

  const [prevInitialParties, setPrevInitialParties] = useState(initialParties);
  if (initialParties !== prevInitialParties) {
    setPrevInitialParties(initialParties);
    setParties(initialParties);
  }

  // Toast auto-dismiss after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleCopyInvite = async (party) => {
    try {
      const inviteUrl = `${window.location.origin}/watch-party/${party.roomCode}`;
      await navigator.clipboard.writeText(inviteUrl);
      setToast({ type: "success", message: "Invite copied" });
    } catch {
      try {
        await navigator.clipboard.writeText(party.roomCode);
        setToast({ type: "success", message: "Invite copied" });
      } catch (err) {
        console.error("Failed to copy invite:", err);
        setToast({ type: "error", message: "Could not copy invite link" });
      }
    }
  };

  const handleOpenDeleteModal = (party) => {
    setDeleteError("");
    setPartyToDelete(party);
  };

  const handleConfirmDelete = async () => {
    if (!partyToDelete || isDeleting) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await deleteWatchPartyAction(partyToDelete.roomCode);
      if (!res?.success) {
        setDeleteError(res?.error || "Failed to delete the watch party.");
        setIsDeleting(false);
        return;
      }

      // 1. Eliminar inmediatamente la card de My Parties (sin requerir refresh)
      const targetRoomCode = partyToDelete.roomCode;
      const targetId = partyToDelete.id;
      setParties((prev) =>
        prev.filter((p) => p.id !== targetId && p.roomCode !== targetRoomCode),
      );

      // 2. Cerrar el modal
      setPartyToDelete(null);
      setIsDeleting(false);

      // 3. Mostrar feedback breve de éxito
      setToast({
        type: "success",
        message: "Watch Party deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting party:", err);
      setDeleteError(err.message || "Failed to delete the watch party.");
      setIsDeleting(false);
    }
  };

  return (
    <>
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
              {parties.length} {parties.length === 1 ? "party" : "parties"} created
            </p>
          </div>
        </div>

        {parties.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {parties.map((party) => (
              <PartyCard
                key={party.id}
                party={party}
                currentUserId={currentUserId}
                onCopyInvite={handleCopyInvite}
                onOpenDeleteModal={handleOpenDeleteModal}
              />
            ))}
          </div>
        )}
      </section>

      {/* DELETE CONFIRMATION MODAL */}
      {partyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
                <IoTrashOutline className="text-xl" />
              </div>
              <div>
                <h3 className="font-body text-base font-bold uppercase text-white">
                  Delete this Watch Party?
                </h3>
                <p className="mt-1 font-body text-xs text-zinc-400 leading-relaxed">
                  Esta acción eliminará la sala y no podrá recuperarse.
                </p>
                {partyToDelete.title && (
                  <p className="mt-2 font-mono text-xs text-zinc-300 font-semibold truncate max-w-[220px]">
                    {partyToDelete.title}
                  </p>
                )}
              </div>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setPartyToDelete(null);
                  setDeleteError("");
                }}
                className="rounded-lg border border-zinc-700 bg-transparent px-3.5 py-2 font-body text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Party</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#0c110b] px-4 py-3 shadow-2xl backdrop-blur-md"
        >
          {toast.type === "success" ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-lime-400">
              <IoCheckmark className="text-sm font-bold" />
            </span>
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <IoAlertCircleOutline className="text-sm font-bold" />
            </span>
          )}
          <span className="font-body text-xs font-semibold text-white">
            {toast.message}
          </span>
        </div>
      )}
    </>
  );
}

/* -------------------------------- */
/* PARTY CARD */
/* -------------------------------- */

function PartyCard({
  party,
  currentUserId,
  onCopyInvite,
  onOpenDeleteModal,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isActive = party.status === "active";
  const isOwner = Boolean(currentUserId && party.userId === currentUserId);

  // Close menu on click outside or escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] transition-all duration-300 hover:-translate-y-1 hover:border-lime-400/30 hover:shadow-[0_0_35px_rgba(163,255,0,0.06)]">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-lime-400/5 blur-3xl transition-all duration-500 group-hover:bg-lime-400/10" />

      <div className="relative z-10 p-6">
        {/* TOP */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/5 text-xl text-lime-400">
              <IoVideocamOutline />
            </div>

            <div className="min-w-0">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Watch Party
              </p>

              <h3 className="mt-1 line-clamp-1 font-body text-base font-bold text-white">
                {party.title || "Untitled Party"}
              </h3>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={`rounded-full border px-3 py-1 font-body text-[9px] font-bold uppercase tracking-[0.15em] ${
                isActive
                  ? "border-lime-400/30 bg-lime-400/5 text-lime-400"
                  : "border-zinc-700 bg-zinc-800/50 text-zinc-500"
              }`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>

            {/* Menu button "..." */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label="Party options"
                aria-expanded={menuOpen}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-zinc-400 transition-all duration-200 hover:border-zinc-800 hover:bg-zinc-800/60 hover:text-white active:scale-95"
              >
                <IoEllipsisHorizontal className="text-base" />
              </button>

              {/* Menu dropdown */}
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 z-30 w-40 rounded-xl border border-zinc-800 bg-[#0c110b] p-1.5 shadow-2xl backdrop-blur-md"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onCopyInvite(party);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-body text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-white"
                  >
                    <IoCopyOutline className="text-sm text-zinc-400" />
                    <span>Copy Invite</span>
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenDeleteModal(party);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-body text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      <IoTrashOutline className="text-sm text-red-400" />
                      <span>Delete Party</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FiLogIn } from "react-icons/fi";
import { IoClose, IoSparklesOutline } from "react-icons/io5";
import { normalizeRoomCode } from "@/lib/parties/roomCodes";

export default function JoinByCodeModal({
  variant = "button", // "button" | "modal-only"
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  triggerClassName,
  children,
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const handleOpen = () => {
    setError("");
    setCode("");
    if (isControlled) {
      // controlled
    } else {
      setInternalOpen(true);
    }
  };

  const handleClose = useCallback(() => {
    if (loading) return;
    setError("");
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalOpen(false);
    }
  }, [loading, isControlled, controlledOnClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const clean = normalizeRoomCode(code);
    if (!clean) {
      setError("Por favor, ingresá un código de sala válido.");
      return;
    }
    setCode(clean);

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/rooms/verify?code=${encodeURIComponent(clean)}`,
      );
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setError(
          data.error ||
            "No se encontró ninguna sala con este código. Verificá que sea correcto.",
        );
        setLoading(false);
        return;
      }

      // Successful verification -> Navigate to room
      handleClose();
      router.push(`/watch-party/${data.roomId}`);
    } catch {
      setError("Error de conexión al verificar la sala. Intentá nuevamente.");
      setLoading(false);
    }
  };

  return (
    <>
      {variant === "button" && (
        <button
          type="button"
          onClick={handleOpen}
          className={
            triggerClassName ||
            "inline-flex h-14 items-center justify-center gap-3 rounded-lg border border-lime-400 bg-transparent px-6 font-body text-base font-bold uppercase tracking-wider text-lime-400 transition-all duration-300 hover:bg-lime-400 hover:text-[#080b08] hover:shadow-[0_0_30px_rgba(163,255,0,0.22)] active:scale-95"
          }
        >
          {children || (
            <>
              <FiLogIn className="text-xl" />
              <span>Unirse con código</span>
            </>
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={handleClose}
          />

          {/* Modal Card */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b] p-6 shadow-2xl transition-all sm:p-7">
            {/* Glow effect */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-lime-400/10 blur-3xl" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,255,0,0.8)]" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400">
                    Watch Party Protocol
                  </span>
                </div>
                <h3 className="font-body text-2xl font-bold uppercase tracking-tight text-white">
                  Room Code
                </h3>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                aria-label="Cerrar modal"
              >
                <IoClose className="text-xl" />
              </button>
            </div>

            <p className="mt-2 font-body text-xs font-medium leading-relaxed text-zinc-400">
              Ingresá el código de la sala o pegá el link de invitación que te
              compartieron.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="room-code-input"
                  className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                >
                  Código de sala
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="room-code-input"
                    type="text"
                    required
                    value={code}
                    disabled={loading}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setError("");
                    }}
                    onBlur={() => {
                      if (code.trim()) {
                        setCode(normalizeRoomCode(code));
                      }
                    }}
                    placeholder="Ej: A7K2P9"
                    className="h-12 w-full rounded-xl border border-zinc-800 bg-[#080b08] px-4 font-mono text-sm font-bold tracking-widest text-lime-400 placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-600 outline-none transition focus:border-lime-400/80 focus:ring-1 focus:ring-lime-400/20 disabled:opacity-50"
                  />
                  {code && (
                    <button
                      type="button"
                      onClick={() => setCode("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-400">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 font-body text-sm font-bold uppercase tracking-wider text-[#080b08] transition-all hover:bg-lime-300 hover:shadow-[0_0_25px_rgba(163,255,0,0.25)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#080b08] border-t-transparent" />
                      <span>Verificando sala...</span>
                    </>
                  ) : (
                    <>
                      <IoSparklesOutline className="text-base" />
                      <span>Unirse</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

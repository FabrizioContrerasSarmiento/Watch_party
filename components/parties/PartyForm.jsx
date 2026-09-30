"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createParty,
  generatePartyRoomCode,
} from "@/app/dashboard/parties/new/actions";
import {
  generateRoomCode as fallbackGenerateCode,
  normalizeRoomCode,
} from "@/lib/parties/roomCodes";

import {
  IoArrowBack,
  IoCheckmark,
  IoLink,
  IoPlay,
  IoVideocamOutline,
} from "react-icons/io5";

export default function PartyForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerateCode() {
    setGeneratingCode(true);
    try {
      const res = await generatePartyRoomCode();
      if (res?.success && res.code) {
        setRoomCode(res.code);
      } else {
        setRoomCode(fallbackGenerateCode());
      }
    } catch {
      setRoomCode(fallbackGenerateCode());
    } finally {
      setGeneratingCode(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const formData = new FormData(event.currentTarget);

      const result = await createParty(formData);

      if (!result?.success) {
        setError(result?.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      router.push("/dashboard/parties");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Unable to create the party.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl">
      {/* Main card */}
      <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c110b]">
        {/* Glow */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-lime-400/5 blur-3xl" />

        <div className="relative z-10 p-7 lg:p-10">
          {/* Card header */}
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/10 text-lime-400">
              <IoVideocamOutline className="text-2xl" />
            </div>

            <div>
              <h2 className="font-body text-lg font-bold uppercase text-white">
                Party Details
              </h2>

              <p className="mt-1 font-body text-xs font-medium text-zinc-500">
                Set up your watch room
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="mb-2 block font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-400"
              >
                Party Name
              </label>

              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={80}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Friday Night Watch"
                className="h-12 w-full rounded-lg border border-zinc-800 bg-[#080b08] px-4 font-body text-sm font-medium text-white outline-none transition-all placeholder:text-zinc-600 focus:border-lime-400/60 focus:ring-1 focus:ring-lime-400/20"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-2 block font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-400"
              >
                Description
              </label>

              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={250}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are you watching?"
                className="w-full resize-none rounded-lg border border-zinc-800 bg-[#080b08] px-4 py-3 font-body text-sm font-medium text-white outline-none transition-all placeholder:text-zinc-600 focus:border-lime-400/60 focus:ring-1 focus:ring-lime-400/20"
              />
            </div>

            {/* Room code */}
            <div>
              <label
                htmlFor="roomCode"
                className="mb-2 block font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-400"
              >
                Room Code
              </label>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <IoLink className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-zinc-600" />

                  <input
                    id="roomCode"
                    name="roomCode"
                    type="text"
                    required
                    maxLength={6}
                    value={roomCode}
                    onChange={(event) => {
                      const normalized = normalizeRoomCode(event.target.value);
                      setRoomCode(normalized.slice(0, 6));
                    }}
                    placeholder="A7K2P9"
                    className="h-12 w-full rounded-lg border border-zinc-800 bg-[#080b08] pl-11 pr-4 font-mono text-sm font-bold tracking-[0.14em] text-lime-400 outline-none transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-zinc-600 focus:border-lime-400/60 focus:ring-1 focus:ring-lime-400/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={generatingCode}
                  className="h-12 shrink-0 rounded-lg border border-zinc-700 px-5 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-300 transition-all hover:border-lime-400 hover:text-lime-400 disabled:opacity-50"
                >
                  {generatingCode ? "Generating..." : "Generate"}
                </button>
              </div>

              <p className="mt-2 font-body text-xs font-medium text-zinc-600">
                Share this 6-character code with the people you want to invite.
              </p>
            </div>

            {/* Video */}
            <div>
              <label
                htmlFor="videoUrl"
                className="mb-2 block font-body text-xs font-bold uppercase tracking-[0.12em] text-zinc-400"
              >
                YouTube Video
              </label>

              <div className="relative">
                <IoPlay className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-zinc-600" />

                <input
                  id="videoUrl"
                  name="videoUrl"
                  type="url"
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="h-12 w-full rounded-lg border border-zinc-800 bg-[#080b08] pl-11 pr-4 font-body text-sm font-medium text-white outline-none transition-all placeholder:text-zinc-600 focus:border-lime-400/60 focus:ring-1 focus:ring-lime-400/20"
                />
              </div>

              <p className="mt-2 font-body text-xs font-medium text-zinc-600">
                You can change the video later inside the party.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="font-body text-sm font-medium text-red-400">
                {error}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-zinc-800 pt-7 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-800 px-6 font-body text-xs font-bold uppercase tracking-[0.08em] text-zinc-400 transition-all hover:border-zinc-600 hover:text-white disabled:opacity-50"
            >
              <IoArrowBack />
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-lime-400 px-7 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#080b08] transition-all hover:bg-lime-300 hover:shadow-[0_0_30px_rgba(163,255,0,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IoCheckmark className="text-lg" />
              {loading ? "Creating..." : "Create Watch Party"}
            </button>
          </div>
        </div>
      </article>
    </form>
  );
}

"use client";

import { useState } from "react";

import { updateProfile } from "@/app/dashboard/profile/actions";

export default function ProfileForm({ profile }) {
  const [error, setError] = useState("");

  return (
    <form
      action={async (formData) => {
        setError("");

        try {
          await updateProfile(formData);
        } catch (error) {
          setError(error.message || "Something went wrong.");
        }
      }}
      className="space-y-6"
    >
      {/* DISPLAY NAME */}
      <div>
        <label
          htmlFor="displayName"
          className="mb-2 block font-body text-sm font-semibold text-zinc-300"
        >
          Display name
        </label>

        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={profile.displayName}
          maxLength={50}
          placeholder="Enter your name"
          className="h-12 w-full rounded-xl border border-zinc-800 bg-[#101810] px-4 font-body text-sm font-medium text-white outline-none transition placeholder:text-zinc-600 focus:border-lime-400/60 focus:ring-1 focus:ring-lime-400/20"
        />
      </div>

      {/* EMAIL */}
      <div>
        <label
          htmlFor="email"
          className="mb-2 block font-body text-sm font-semibold text-zinc-300"
        >
          Email
        </label>

        <input
          id="email"
          type="email"
          value={profile.email}
          disabled
          className="h-12 w-full cursor-not-allowed rounded-xl border border-zinc-800 bg-[#101810]/60 px-4 font-body text-sm font-medium text-zinc-500"
        />

        <p className="mt-2 font-body text-xs font-medium text-zinc-600">
          Your email address is managed by your authentication provider.
        </p>
      </div>

      {/* ROLE */}
      <div>
        <label
          htmlFor="role"
          className="mb-2 block font-body text-sm font-semibold text-zinc-300"
        >
          Account role
        </label>

        <input
          id="role"
          type="text"
          value={profile.user_type}
          disabled
          className="h-12 w-full cursor-not-allowed rounded-xl border border-zinc-800 bg-[#101810]/60 px-4 font-body text-sm font-semibold uppercase text-zinc-500"
        />
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 font-body text-sm font-medium text-red-400">
          {error}
        </div>
      )}

      {/* SAVE */}
      <button
        type="submit"
        className="h-12 rounded-xl bg-lime-400 px-6 font-body text-sm font-bold text-[#080b08] transition hover:bg-lime-300 hover:shadow-[0_0_25px_rgba(163,255,0,0.15)]"
      >
        Save changes
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase/client";

async function persistSession(user) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/session/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error("No se pudo crear la sesion en el servidor.");
  }
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard";
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  async function finishLogin(userCredential) {
    setLoadingMessage("Creando sesion segura...");
    await persistSession(userCredential.user);
    setLoadingMessage("Redirigiendo al dashboard...");
    router.push(nextUrl);
    router.refresh();
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setLoadingMessage(
      mode === "signup" ? "Creando cuenta..." : "Iniciando sesion...",
    );
    setError("");

    try {
      const action =
        mode === "signup"
          ? createUserWithEmailAndPassword
          : signInWithEmailAndPassword;

      await finishLogin(await action(getClientAuth(), email, password));
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesion.");
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setLoadingMessage("Conectando con Google...");
    setError("");

    try {
      await finishLogin(
        await signInWithPopup(getClientAuth(), getGoogleProvider()),
      );
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesion con Google.");
      setLoading(false);
      setLoadingMessage("");
    }
  }

  return (
    <section
      className="w-full max-w-md rounded-2xl border border-lime-400/30 bg-[#0c110b] p-6 shadow-[0_0_30px_rgba(163,255,0,0.06)] sm:p-8"
      aria-labelledby="login-title"
    >
      <div
        className="mb-8 grid grid-cols-2 rounded-xl border border-zinc-800 bg-[#080b08] p-1"
        aria-label="Authentication mode"
      >
        <button
          type="button"
          className={`h-11 rounded-lg font-body text-sm font-semibold transition ${
            mode === "signin"
              ? "bg-lime-400 text-[#080b08]"
              : "text-zinc-500 hover:text-zinc-200"
          }`}
          onClick={() => setMode("signin")}
          disabled={loading}
        >
          Sign in
        </button>

        <button
          type="button"
          className={`h-11 rounded-lg font-body text-sm font-semibold transition ${
            mode === "signup"
              ? "bg-lime-400 text-[#080b08]"
              : "text-zinc-500 hover:text-zinc-200"
          }`}
          onClick={() => setMode("signup")}
          disabled={loading}
        >
          Create account
        </button>
      </div>

      <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
        Watch Party
      </p>

      <h1
        id="login-title"
        className="mt-3 font-body text-4xl font-bold uppercase leading-none text-white"
      >
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>

      <p className="mt-4 font-body text-sm font-medium leading-6 text-zinc-500">
        {mode === "signup"
          ? "Create an account and start watching together with your friends."
          : "Sign in to continue to your Watch Party account."}
      </p>

      <form onSubmit={handleEmailSubmit} className="mt-8 grid gap-5">
        <label className="grid gap-2 font-body text-sm font-semibold text-zinc-300">
          <span>Email</span>

          <input
            className="h-12 rounded-lg border border-zinc-800 bg-[#080b08] px-4 font-body text-sm font-medium text-white outline-none transition placeholder:text-zinc-700 focus:border-lime-400 focus:ring-1 focus:ring-lime-400/30"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={loading}
            required
          />
        </label>

        <label className="grid gap-2 font-body text-sm font-semibold text-zinc-300">
          <span>Password</span>

          <input
            className="h-12 rounded-lg border border-zinc-800 bg-[#080b08] px-4 font-body text-sm font-medium text-white outline-none transition placeholder:text-zinc-700 focus:border-lime-400 focus:ring-1 focus:ring-lime-400/30"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={6}
            disabled={loading}
            required
          />
        </label>

        <button
          type="submit"
          className="mt-1 h-12 rounded-lg bg-lime-400 px-4 font-body text-sm font-bold text-[#080b08] transition hover:bg-lime-300 hover:shadow-[0_0_25px_rgba(163,255,0,0.15)] disabled:hover:bg-lime-400"
          disabled={loading}
        >
          {loading
            ? "Processing..."
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <div className="my-7 flex items-center gap-3 font-body text-xs font-semibold text-zinc-600">
        <span className="h-px flex-1 bg-zinc-800" />
        <span>OR</span>
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <button
        type="button"
        className="h-12 w-full rounded-lg border border-zinc-800 bg-transparent px-4 font-body text-sm font-semibold text-zinc-200 transition hover:border-lime-400/50 hover:bg-[#101810] hover:text-white"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        {loading ? "Processing..." : "Continue with Google"}
      </button>

      {error ? (
        <p className="mt-5 rounded-lg border border-red-900/70 bg-red-950/40 p-3 font-body text-sm font-medium leading-6 text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#080b08]/90 px-5 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-2xl border border-lime-400/30 bg-[#0c110b] p-7 text-center shadow-[0_0_40px_rgba(163,255,0,0.08)]">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border border-zinc-700 border-t-lime-400" />

            <p className="mt-5 font-body text-sm font-bold text-white">
              {loadingMessage || "Processing authentication..."}
            </p>

            <p className="mt-2 font-body text-sm font-medium leading-6 text-zinc-500">
              Validating your identity and preparing your session.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#101a0b] px-6 py-24 lg:px-10 lg:py-28">
      {/* GLOW */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/10 blur-[120px]" />

      <div className="relative mx-auto max-w-4xl text-center">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
          Start watching
        </p>

        <h2 className="mt-5 font-body text-5xl font-bold uppercase leading-[0.9] text-white sm:text-6xl lg:text-7xl">
          Ready to watch
          <br />
          <span className="text-lime-400">together?</span>
        </h2>

        <p className="mx-auto mt-7 max-w-xl font-body text-base font-medium leading-7 text-zinc-400 sm:text-lg">
          Create your first Watch Party and bring your friends together,
          wherever they are.
        </p>

        <Link
          href="/login"
          className="group mt-9 inline-flex h-14 items-center justify-center gap-4 rounded-md bg-lime-400 px-8 font-body text-sm font-bold text-[#080b08] transition-all duration-300 hover:bg-lime-300 hover:shadow-[0_0_35px_rgba(163,255,0,0.2)]"
        >
          Create a Watch Party
          <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}

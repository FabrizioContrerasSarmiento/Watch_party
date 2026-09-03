import Link from "next/link";
import Image from "next/image";
import { FaArrowRightLong } from "react-icons/fa6";

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#080b08] px-6 py-24 lg:px-10 lg:py-8">
      {/* SOMBREADO SUPERIOR */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-[#080b08] to-transparent" />

      {/* SOMBREADO INFERIOR */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-[#080b08] to-transparent" />

      {/* GLOW */}
      <div className="pointer-events-none absolute right-[10%] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-lime-400/10 blur-[120px]" />

      {/* CONTENIDO */}
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-12">
        {/* TEXTO */}
        <div className="relative z-10 max-w-2xl">
          <h2 className="mt-5 font-body text-5xl font-bold uppercase leading-[0.9] text-white sm:text-6xl lg:text-7xl">
            Ready to watch
            <br />
            <span className="text-lime-400">together?</span>
          </h2>

          <Link
            href="/login"
            className="group mt-9 inline-flex h-14 items-center justify-center gap-4 rounded-md bg-lime-400 px-8 font-body text-sm font-bold text-[#080b08] transition-all duration-300 hover:bg-lime-300 hover:shadow-[0_0_35px_rgba(163,255,0,0.2)]"
          >
            Create a Watch Party
            <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">
              <FaArrowRightLong />
            </span>
          </Link>
        </div>

        {/* IMAGEN */}
        <div className="pointer-events-none relative hidden h-[550px] w-[600px] shrink-0 lg:block">
          <Image
            src="/items/door.png"
            alt=""
            fill
            className="object-contain scale-125 drop-shadow-[0_0_40px_rgba(163,255,0,0.25)]"
          />
        </div>
      </div>
    </section>
  );
}

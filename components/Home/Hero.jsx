import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-76px)] overflow-hidden bg-[#080b08]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(163,255,0,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(163,255,0,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "45px 45px",
          maskImage:
            "radial-gradient(circle at center, black 20%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, black 20%, transparent 80%)",
        }}
      />

      <div className="pointer-events-none absolute left-[35%] top-[35%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/5 blur-[120px]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-[1fr_0.8fr] lg:px-10 lg:py-20">
        <div className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-lime-400/70 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-lime-400" />

            <span className="font-body text-xs font-medium uppercase tracking-[0.12em] text-lime-400">
              Watch with friends
            </span>
          </div>

          <h1 className="font-body font-bold text-6xl uppercase leading-[0.86] tracking-tight text-white sm:text-7xl lg:text-[88px]">
            A new way to
            <br />
            <span className="text-lime-400">watch TV together</span>
          </h1>

          <div className="mt-8 max-w-xl space-y-4">
            <p className="font-body font-semibold text-lg leading-7 text-zinc-300 sm:text-xl">
              Watch your favorite shows and movies in sync with friends, no
              matter where you are.
            </p>

            <p className="font-body font-[cursive] font-semibold text-base leading-7 text-zinc-500">
              Real-time chat, shared reactions, and a watching experience that
              feels like you're in the same room.
            </p>
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="group  inline-flex h-14 items-center justify-center gap-5 rounded-md bg-lime-400 px-7 font-body text-lg  font-semibold text-black transition-all duration-300 hover:bg-lime-300 hover:shadow-[0_0_35px_rgba(163,255,0,0.18)]"
            >
              <span className="font-body font-semibold">
                Get Watch Party for free!
              </span>

              <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          {/* COMPATIBILIDAD */}
          <div className="mt-8 flex items-center gap-3 text-zinc-500">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-lime-400/60 text-xs text-lime-400">
              ◉
            </span>

            <span className="font-body text-sm  sm:text-sm">
              Available on Chrome, Edge & Safari
            </span>
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          {/* GLOW */}
          <div className="absolute top-1/2 h-[500px] w-[350px] -translate-y-1/2 rounded-full bg-lime-400/10 blur-[100px]" />

          {/* TELEFONO */}
          <div className="relative z-10 w-[280px] sm:w-[330px] lg:w-[390px]">
            <Image
              src="/items/watch-party-phone.png"
              alt="Watch Party app"
              width={800}
              height={1600}
              priority
              className="h-auto w-full object-contain drop-shadow-[0_0_45px_rgba(0,0,0,0.8)]"
            />
          </div>

          {/* ICONO CHAT */}
          <div className="absolute right-[-5px] top-[18%] z-20 hidden h-16 w-16 items-center justify-center rounded-2xl border border-lime-400 bg-[#080b08] text-2xl text-lime-400 shadow-[0_0_30px_rgba(163,255,0,0.12)] lg:flex">
            💬
          </div>

          {/* CORAZÓN */}
          <div className="absolute bottom-[20%] left-[-15px] z-20 hidden text-5xl text-lime-400 lg:block">
            ♡
          </div>

          {/* SMILE */}
          <div className="absolute right-[-25px] top-[43%] z-20 hidden text-5xl text-lime-400 lg:block">
            ☺
          </div>

          {/* PARTICIPANTES */}
          <div className="absolute bottom-[15%] right-[-15px] z-20 hidden text-4xl text-lime-400 lg:block">
            ♧
          </div>
        </div>
      </div>
    </section>
  );
}

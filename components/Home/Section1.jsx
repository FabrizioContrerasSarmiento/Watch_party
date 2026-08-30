import Image from "next/image";

const features = [
  {
    image: "/items/watch.png",
    title: "WATCH TOGETHER",
    subtitle: "Synchronized video",
    description:
      "Watch YouTube videos together and keep everyone at the exact same moment, no matter where they are.",
  },
  {
    image: "/items/chat.png",
    title: "CHAT IN REAL TIME",
    subtitle: "Talk while you watch",
    description:
      "Comment, react, and share the moment with your friends through the room's live chat.",
  },
  {
    image: "/items/invite.png",
    title: "CREATE YOUR PARTY",
    subtitle: "Invite your friends",
    description:
      "Create a room, share the code, and start watching together in seconds.",
  },
];

export default function Features() {
  return (
    <section className="relative overflow-hidden bg-[#080b08] px-6 py-24 lg:px-8 lg:py-10">
      {/* GRID DE FONDO */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(163,255,0,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(163,255,0,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "45px 45px",
          maskImage:
            "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl">
        {/* HEADER */}
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
            Watch Party
          </p>

          <h2 className="mt-5 font-body text-5xl font-bold uppercase leading-[0.9] text-white sm:text-6xl lg:text-7xl xl:text-[82px]">
            Everything you need
            <br />
            <span className="text-lime-400">to watch together</span>
          </h2>

          <p className="mx-auto mt-8 max-w-3xl font-body text-base font-medium leading-7 text-zinc-500 sm:text-lg">
            A new way to share your favorite shows and movies with the people
            you care about.
          </p>
        </div>

        {/* CARDS */}
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="group relative overflow-hidden rounded-2xl border border-lime-400/40 bg-[#0c110b] p-7 shadow-[0_0_20px_rgba(163,255,0,0.08)] transition-all duration-500 hover:-translate-y-1 hover:border-lime-400 hover:shadow-[0_0_30px_rgba(163,255,0,0.18)]"
            >
              {/* NUMBER */}
              <div className="flex items-start justify-between">
                <span className="font-body text-sm font-semibold tracking-[0.1em] text-lime-400">
                  {feature.number}
                </span>
              </div>

              {/* IMAGE */}
              <div className="mt-8 flex h-60 items-center justify-center overflow-hidden">
                <Image
                  src={feature.image}
                  alt={feature.title}
                  width={800}
                  height={800}
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* TITLE */}
              <h3 className="mt-8 font-body text-3xl font-bold uppercase leading-none text-white">
                {feature.title}
              </h3>

              {/* SUBTITLE */}
              <p className="mt-3 font-body text-sm font-semibold text-lime-400">
                {feature.subtitle}
              </p>

              {/* DESCRIPTION */}
              <p className="mt-5 font-body text-sm font-semibold leading-6 text-zinc-500">
                {feature.description}
              </p>

              {/* BOTTOM LINE */}
              <div className="mt-8 h-px w-full bg-zinc-800 transition-all duration-500 group-hover:bg-lime-400/50" />

              {/* CORNER DETAIL */}
              <div className="absolute bottom-0 right-0 h-16 w-16 translate-x-8 translate-y-8 rounded-full bg-lime-400/5 blur-2xl transition-all duration-500 group-hover:bg-lime-400/15" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

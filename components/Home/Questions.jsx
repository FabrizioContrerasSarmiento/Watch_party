"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How does Watch Party work?",
    answer:
      "Create a party, invite your friends using a room code or link, add a YouTube video, and start watching together in real time.",
  },
  {
    question: "Can I watch any YouTube video with my friends?",
    answer:
      "You can add YouTube videos to your party as long as they are available to watch normally on YouTube. Watch Party does not host or upload the videos itself.",
  },
  {
    question: "How does video synchronization work?",
    answer:
      "The video playback is synchronized for everyone in the room. When the video is played, paused, or moved to another moment, the change is reflected across the party.",
  },
  {
    question: "Can everyone control the video?",
    answer:
      "The party creator manages the playback controls, including play, pause, and seeking through the video.",
  },
  {
    question: "Can I chat with everyone in the party?",
    answer:
      "Yes. Every party includes a real-time chat where participants can send messages and react while watching.",
  },
  {
    question: "How do I invite my friends to a party?",
    answer:
      "Create a party and share its unique room code or invitation link with your friends. They can use it to join your room.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="questions"
      className="relative overflow-hidden bg-[#080b08] px-6 py-24 lg:px-10 lg:py-22"
    >
      {/* GRID */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
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

      <div className="relative mx-auto w-full max-w-4xl">
        {/* HEADER */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
            FAQ
          </p>

          <h2 className="mt-5 font-body text-5xl font-bold uppercase leading-[0.9] text-white sm:text-6xl">
            Frequently Asked
            <br />
            <span className="text-lime-400">Questions</span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl font-body text-base font-medium leading-7 text-zinc-500 sm:text-lg">
            Everything you need to know about watching together with Watch
            Party.
          </p>
        </div>

        {/* FAQ LIST */}
        <div className="mt-14 space-y-2">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div key={faq.question} className="overflow-hidden rounded-xl">
                {/* QUESTION */}
                <button
                  type="button"
                  onClick={() => toggleFAQ(index)}
                  className={`flex w-full items-center justify-between gap-6 px-5 py-4 text-left font-body text-[1.15em] font-bold transition-colors duration-300 sm:px-6 sm:py-5 ${
                    isOpen
                      ? "bg-[#dfffc5] text-[#18220f]"
                      : "bg-[#dfffc5] text-[#18220f] hover:bg-[#cfffad]"
                  }`}
                >
                  <span>{faq.question}</span>

                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-2xl font-medium transition-transform duration-300 ${
                      isOpen ? "rotate-45" : "rotate-0"
                    }`}
                  >
                    +
                  </span>
                </button>

                {/* ANSWER */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="bg-[#17220f] px-5 py-5 sm:px-6">
                      <p className="max-w-3xl font-body text-[1em] font-medium leading-6 text-zinc-300">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInstagram,
  faLinkedinIn,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";

export default function Footer() {
  return (
    <footer className="w-full bg-[#080b08]">
      <div className="w-full">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 md:py-12">
          {/* LOGO */}
          <Link href="/" className="group inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center border border-lime-400 transition-all duration-300 group-hover:bg-lime-400">
              <span className="font-body font-bold text-lg leading-none text-lime-400 group-hover:text-black">
                W
              </span>
            </div>

            <span className="font-body font-bold text-xl uppercase tracking-[0.08em] text-white">
              Watch Party
            </span>
          </Link>

          {/* LINKS */}
          <nav
            aria-label="Links del footer"
            className="mt-8 flex flex-wrap gap-x-7 gap-y-3"
          >
            <Link
              href="/"
              className="font-body font-bold text-sm text-zinc-300 transition-colors hover:text-lime-400"
            >
              Home
            </Link>

            <Link
              href="/Questions"
              className="font-body font-bold text-sm text-zinc-300 transition-colors hover:text-lime-400"
            >
              Questions
            </Link>

            <Link
              href="/login"
              className="font-body font-bold text-sm text-zinc-300 transition-colors hover:text-lime-400"
            >
              Login
            </Link>
          </nav>

          {/* SOCIALS */}
          <div className="mt-7 flex gap-2">
            <a
              href="#"
              aria-label="Instagram"
              className="grid h-7 w-7 place-items-center rounded-[5px] bg-lime-400 text-[#101a0b] transition-transform hover:-translate-y-1"
            >
              <FontAwesomeIcon icon={faInstagram} className="w-[1.3em]" />
            </a>

            <a
              href="#"
              aria-label="LinkedIn"
              className="grid h-7 w-7 place-items-center rounded-[5px] bg-lime-400 text-[#101a0b] transition-transform hover:-translate-y-1"
            >
              <span className="text-[15px] font-bold ">in</span>
            </a>

            <a
              href="#"
              aria-label="Twitter"
              className="grid h-7 w-7 place-items-center rounded-[5px] bg-lime-400 text-[#101a0b] transition-transform hover:-translate-y-1"
            >
              <span className="text-[15px] font-bold">X</span>
            </a>
          </div>

          {/* DIVIDER */}
          <div className="mt-7 border-t border-lime-900/40 pt-5">
            <p className="font-body text-xs text-zinc-500">
              © 2026 Watch Party. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

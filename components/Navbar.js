"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/dashboard/actions";
import { RiLoginCircleFill } from "react-icons/ri";

function isActivePath(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, onClick, pathname }) {
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        relative px-4 py-2 text-sm transition-all duration-300
        ${active ? "text-white" : "text-zinc-400 hover:text-white"}

        after:absolute after:bottom-0 after:left-1/2
        after:h-px after:-translate-x-1/2
        after:bg-lime-400 after:transition-all after:duration-300

        ${active ? "after:w-5" : "after:w-0 hover:after:w-5"}
      `}
    >
      {label}
    </Link>
  );
}

export default function Navbar({ actions, profile, user }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const userType = profile?.user_type || "user";
  const isAdmin = userType === "admin";

  function closeMenu() {
    setIsOpen(false);
  }

  const publicLinks = [
    { href: "/", label: "Home" },
    { href: "/#questions", label: "Questions" },
  ];

  const privateLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/items", label: "Watch Parties" },
    ...(isAdmin ? [{ href: "/dashboard/users", label: "Usuarios" }] : []),
  ];

  const links = user ? privateLinks : publicLinks;

  function handleQuestionsClick(event) {
    event.preventDefault();
    closeMenu();

    const section = document.getElementById("questions");

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  return (
    <nav className="relative border-b border-zinc-800/80 bg-[#080b08]">
      {/* Grid tecnológico de fondo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "42px 42px",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-6 lg:px-10">
        <div className="flex min-h-[76px] items-center justify-between">
          {/* LOGO / MARCA */}
          <Link
            href="/"
            onClick={closeMenu}
            className="group flex items-center gap-2"
          >
            {/* Logo temporal */}
            <div className="flex h-8 w-8 items-center justify-center border border-lime-400 transition-all duration-300 group-hover:bg-lime-400">
              <span className="font-body text-lg leading-none text-lime-400 group-hover:text-black">
                W
              </span>
            </div>

            <span className="font-body font-bold text-xl uppercase tracking-[0.08em] text-white">
              Watch Party
            </span>
          </Link>

          {/* DESKTOP */}
          <div className="hidden items-center md:flex">
            {/* LINKS CENTRALES */}
            <div className="absolute left-1/2 flex -translate-x-1/2 items-center">
              {links.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  pathname={pathname}
                  onClick={
                    link.href === "#questions"
                      ? handleQuestionsClick
                      : closeMenu
                  }
                />
              ))}
            </div>

            {/* DERECHA */}
            <div className="ml-auto flex items-center gap-5">
              {actions}

              {user ? (
                <>
                  <span className="hidden text-xs text-zinc-500 lg:block">
                    {user.email || "Sin email"}
                  </span>

                  <form action={logout}>
                    <button
                      type="submit"
                      className="border border-zinc-700 px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-zinc-300 transition-all duration-300 hover:border-lime-400 hover:text-lime-400"
                    >
                      Cerrar sesión
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="group relative inline-flex h-10 items-center justify-center gap-3 overflow-hidden border border-lime-400 px-5 text-xs font-semibold uppercase tracking-[0.08em] text-lime-400 transition-all duration-300 hover:bg-lime-400 hover:text-black"
                >
                  <RiLoginCircleFill className="text-lg" />
                  Login
                </Link>
              )}
            </div>
          </div>

          {/* MOBILE BUTTON */}
          <button
            aria-controls="mobile-menu"
            aria-expanded={isOpen}
            className="grid size-10 place-items-center border border-zinc-700 md:hidden"
            onClick={() => setIsOpen((value) => !value)}
            type="button"
          >
            <span className="sr-only">Abrir menú</span>

            <span className="grid gap-1.5">
              <span className="block h-px w-5 bg-zinc-100" />
              <span className="block h-px w-5 bg-zinc-100" />
              <span className="block h-px w-5 bg-zinc-100" />
            </span>
          </button>
        </div>

        {/* MOBILE MENU */}
        <div
          id="mobile-menu"
          className={`
            grid overflow-hidden transition-[grid-template-rows,padding]
            duration-300 md:hidden
            ${isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr] pb-0"}
          `}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-zinc-800 pt-4">
              <div className="grid gap-1">
                {links.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    pathname={pathname}
                    onClick={
                      link.href === "#questions"
                        ? handleQuestionsClick
                        : closeMenu
                    }
                  />
                ))}
              </div>

              <div className="mt-4 border-t border-zinc-800 pt-4">
                {user ? (
                  <div className="grid gap-3">
                    <span className="text-xs text-zinc-500">
                      {user.email || "Sin email"}
                    </span>

                    <form action={logout}>
                      <button
                        type="submit"
                        className="h-10 w-full border border-zinc-700 text-xs uppercase tracking-[0.08em] text-zinc-300 transition hover:border-lime-400 hover:text-lime-400"
                      >
                        Cerrar sesión
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="flex h-10 w-full items-center justify-center border border-lime-400 text-xs font-semibold uppercase tracking-[0.08em] text-lime-400 transition hover:bg-lime-400 hover:text-black"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

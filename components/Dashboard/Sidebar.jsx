"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/dashboard/actions";
import { FaHouseChimney } from "react-icons/fa6";
import { IoIosTv } from "react-icons/io";
import { FaUserAlt, FaLock, FaChevronLeft, FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";

function isActivePath(pathname, href) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebar({ user, profile }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const userType = profile?.user_type || "user";
  const isAdmin = userType === "admin";

  useEffect(() => {
    const isLight =
      window.localStorage.getItem("watch-party-theme") === "light";
    const html = document.documentElement;

    html.classList.toggle("dark", !isLight);
    html.classList.toggle("light", isLight);
    setTimeout(() => {
      setIsDark(!isLight);
    }, 0);
  }, []);

  // Close mobile sidebar automatically on route change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileOpen(false);
  }

  function toggleTheme() {
    const nextIsDark = !isDark;
    const html = document.documentElement;

    html.classList.toggle("dark", nextIsDark);
    html.classList.toggle("light", !nextIsDark);
    window.localStorage.setItem(
      "watch-party-theme",
      nextIsDark ? "dark" : "light",
    );
    setIsDark(nextIsDark);
  }

  const links = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <FaHouseChimney />,
    },
    {
      href: "/dashboard/parties",
      label: "My Parties",
      icon: <IoIosTv />,
    },
    {
      href: "/dashboard/profile",
      label: "Profile",
      icon: <FaUserAlt />,
    },
  ];

  if (isAdmin) {
    links.push({
      href: "/dashboard/users",
      label: "Administration",
      icon: <FaLock />,
    });
  }

  return (
    <>
      {/* MOBILE TOP BAR (lg:hidden) */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-zinc-800 bg-[#0c110b]/95 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-[#101810] text-lime-400 transition hover:border-lime-400/50 hover:text-lime-300"
          aria-label="Abrir menú"
        >
          <RxHamburgerMenu className="text-xl" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center border border-lime-400 text-lime-400">
            <span className="font-body text-sm font-bold">W</span>
          </div>
          <span className="font-body text-xs font-bold uppercase tracking-[0.08em] text-white">
            Watch Party
          </span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-[#101810] text-zinc-400 transition hover:text-lime-400"
          aria-label="Toggle theme"
        >
          {isDark ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
        </button>
      </header>

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR ASIDE */}
      <aside
        className={`theme-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-zinc-800 bg-[#0c110b] shadow-2xl transition-all duration-300 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 w-72 max-w-[85vw] ${
          isOpen ? "lg:w-64" : "lg:w-20"
        }`}
      >
        {/* HEADER */}
        <div
          className={`flex h-16 sm:h-20 items-center border-b border-zinc-800 px-4 sm:px-5 justify-between ${
            !isOpen ? "lg:justify-center lg:px-0" : ""
          }`}
        >
          {/* Logo & Brand (Always visible on mobile drawer, toggleable on desktop) */}
          <Link
            href="/dashboard"
            onClick={() => setIsMobileOpen(false)}
            className={`items-center gap-3 ${
              isOpen ? "flex" : "flex lg:hidden"
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center border border-lime-400 text-lime-400 transition-colors hover:bg-lime-400 hover:text-[#080b08]">
              <span className="font-body text-lg font-bold">W</span>
            </div>

            <span className="font-body text-base font-bold uppercase tracking-[0.08em] text-white">
              Watch Party
            </span>
          </Link>

          {!isOpen && (
            <Link
              href="/dashboard"
              onClick={() => setIsMobileOpen(false)}
              className="hidden lg:flex"
            >
              <div className="flex h-9 w-9 items-center justify-center border border-lime-400 text-lime-400">
                <span className="font-body text-lg font-bold">W</span>
              </div>
            </Link>
          )}

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-[#101810] hover:text-lime-400 lg:hidden"
            aria-label="Cerrar menú"
          >
            <IoClose className="text-xl" />
          </button>

          {/* Collapse button on desktop */}
          {isOpen && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-[#101810] hover:text-lime-400 lg:flex"
              aria-label="Close sidebar"
            >
              <FaChevronLeft />
            </button>
          )}
        </div>

        {/* OPEN SIDEBAR BUTTON (DESKTOP ONLY WHEN COLLAPSED) */}
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="mx-auto mt-5 hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-[#101810] hover:text-lime-400 lg:flex"
            aria-label="Open sidebar"
          >
            <RxHamburgerMenu />
          </button>
        )}

        {/* NAVIGATION */}
        <nav className="mt-6 sm:mt-8 flex flex-1 flex-col gap-2 px-3 overflow-y-auto">
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className={`group flex h-12 items-center rounded-xl transition-all duration-200 gap-4 px-4 ${
                  !isOpen ? "lg:justify-center lg:px-0 lg:gap-0" : ""
                } ${
                  active
                    ? "bg-lime-400 text-[#080b08] shadow-[0_0_20px_rgba(163,255,0,0.10)]"
                    : "text-zinc-500 hover:bg-[#101810] hover:text-lime-400"
                }`}
              >
                <span className="flex w-6 justify-center font-body text-lg font-semibold shrink-0">
                  {link.icon}
                </span>

                <span
                  className={`font-body text-sm font-semibold truncate ${
                    !isOpen ? "lg:hidden" : "block"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* BOTTOM */}
        <div className="border-t border-zinc-800 p-3 shrink-0">
          {/* THEME (Visible in desktop sidebar, also available in mobile top bar) */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`mb-2 flex h-11 w-full items-center rounded-xl text-zinc-500 transition hover:bg-[#101810] hover:text-lime-400 gap-4 px-4 ${
              !isOpen ? "lg:justify-center lg:px-0 lg:gap-0" : ""
            }`}
          >
            <span className="flex w-6 justify-center text-lg shrink-0">
              {isDark ? <FaSun /> : <FaMoon />}
            </span>

            <span
              className={`font-body text-sm font-semibold ${
                !isOpen ? "lg:hidden" : "block"
              }`}
            >
              {isDark ? "Light mode" : "Dark mode"}
            </span>
          </button>

          {/* USER */}
          <div
            className={`mb-2 flex items-center rounded-xl bg-[#101810] gap-3 px-3 py-3 ${
              !isOpen ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-400 font-body text-sm font-bold text-[#080b08]">
              {user?.email?.charAt(0).toUpperCase() || "W"}
            </div>

            <div
              className={`min-w-0 ${
                !isOpen ? "lg:hidden" : "block"
              }`}
            >
              <p className="truncate font-body text-sm font-bold text-white">
                {user?.displayName || "User"}
              </p>

              <p className="truncate font-body text-xs font-medium text-zinc-500">
                {user?.email || "No email"}
              </p>
            </div>
          </div>

          {/* LOGOUT */}
          <form action={logout}>
            <button
              type="submit"
              className={`flex h-12 w-full items-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:border-red-900/60 hover:bg-red-950/20 hover:text-red-400 gap-4 px-4 ${
                !isOpen ? "lg:justify-center lg:px-0 lg:gap-0" : ""
              }`}
            >
              <span className="flex w-6 justify-center text-lg shrink-0">
                <FaSignOutAlt />
              </span>

              <span
                className={`font-body text-sm font-semibold ${
                  !isOpen ? "lg:hidden" : "block"
                }`}
              >
                Sign out
              </span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

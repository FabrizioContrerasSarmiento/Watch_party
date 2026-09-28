"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/dashboard/actions";
import { FaHouseChimney } from "react-icons/fa6";
import { IoIosTv } from "react-icons/io";
import { FaUserAlt } from "react-icons/fa";
import { FaLock } from "react-icons/fa";
import { FaChevronLeft } from "react-icons/fa";
import { RxHamburgerMenu } from "react-icons/rx";
import { FaSun } from "react-icons/fa";
import { FaMoon } from "react-icons/fa";
import { FaSignOutAlt } from "react-icons/fa";

function isActivePath(pathname, href) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebar({ user, profile }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

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
    <aside
      className={`theme-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-zinc-800 bg-[#0c110b] transition-all duration-300 ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      {/* HEADER */}
      <div
        className={`flex h-20 items-center border-b border-zinc-800 ${
          isOpen ? "justify-between px-5" : "justify-center"
        }`}
      >
        {isOpen && (
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-lime-400 text-lime-400 transition-colors hover:bg-lime-400 hover:text-[#080b08]">
              <span className="font-body text-lg font-bold">W</span>
            </div>

            <span className="font-body text-base font-bold uppercase tracking-[0.08em] text-white">
              Watch Party
            </span>
          </Link>
        )}

        {!isOpen && (
          <Link href="/dashboard">
            <div className="flex h-9 w-9 items-center justify-center border border-lime-400 text-lime-400">
              <span className="font-body text-lg font-bold">W</span>
            </div>
          </Link>
        )}

        {isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-[#101810] hover:text-lime-400"
            aria-label="Close sidebar"
          >
            <FaChevronLeft />
          </button>
        )}
      </div>

      {/* OPEN SIDEBAR BUTTON */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mx-auto mt-5 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-[#101810] hover:text-lime-400"
          aria-label="Open sidebar"
        >
          <RxHamburgerMenu />
        </button>
      )}

      {/* NAVIGATION */}
      <nav className="mt-8 flex flex-1 flex-col gap-2 px-3">
        {links.map((link) => {
          const active = isActivePath(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex h-12 items-center rounded-xl transition-all duration-200 ${
                isOpen ? "gap-4 px-4" : "justify-center px-0"
              } ${
                active
                  ? "bg-lime-400 text-[#080b08] shadow-[0_0_20px_rgba(163,255,0,0.10)]"
                  : "text-zinc-500 hover:bg-[#101810] hover:text-lime-400"
              }`}
            >
              <span className="flex w-6 justify-center font-body text-lg font-semibold">
                {link.icon}
              </span>

              {isOpen && (
                <span className="font-body text-sm font-semibold">
                  {link.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* BOTTOM */}
      <div className="border-t border-zinc-800 p-3">
        {/* THEME */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`mb-2 flex h-11 w-full items-center rounded-xl text-zinc-500 transition hover:bg-[#101810] hover:text-lime-400 ${
            isOpen ? "gap-4 px-4" : "justify-center px-0"
          }`}
        >
          <span className="flex w-6 justify-center text-lg">
            {isDark ? <FaSun /> : <FaMoon />}
          </span>

          {isOpen && (
            <span className="font-body text-sm font-semibold">
              {isDark ? "Light mode" : "Dark mode"}
            </span>
          )}
        </button>

        {/* USER */}
        <div
          className={`mb-2 flex items-center rounded-xl bg-[#101810] ${
            isOpen ? "gap-3 px-3 py-3" : "justify-center py-3"
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-400 font-body text-sm font-bold text-[#080b08]">
            {user?.email?.charAt(0).toUpperCase() || "W"}
          </div>

          {isOpen && (
            <div className="min-w-0">
              <p className="truncate font-body text-sm font-bold text-white">
                {user?.displayName || "User"}
              </p>

              <p className="truncate font-body text-xs font-medium text-zinc-500">
                {user?.email || "No email"}
              </p>
            </div>
          )}
        </div>

        {/* LOGOUT */}
        <form action={logout}>
          <button
            type="submit"
            className={`flex h-12 w-full items-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:border-red-900/60 hover:bg-red-950/20 hover:text-red-400 ${
              isOpen ? "gap-4 px-4" : "justify-center px-0"
            }`}
          >
            <span className="flex w-6 justify-center text-lg">
              <FaSignOutAlt />
            </span>

            {isOpen && (
              <span className="font-body text-sm font-semibold">Sign out</span>
            )}
          </button>
        </form>
      </div>
    </aside>
  );
}

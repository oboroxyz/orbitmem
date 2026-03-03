import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { FiGithub } from "react-icons/fi";
import {
  HiOutlineGlobeAlt,
  HiOutlineMenu,
  HiOutlineTemplate,
  HiOutlineUser,
  HiOutlineX,
} from "react-icons/hi";

const navLinks = [
  { to: "/data", label: "Explore", icon: HiOutlineGlobeAlt },
  { to: "/metrics", label: "Metrics", icon: HiOutlineTemplate },
  { to: "/dashboard", label: "Dashboard", icon: HiOutlineUser },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="border-b border-orbit-700 bg-orbit-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-6">
            {/* Logo — text hidden on mobile */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center text-white font-bold text-sm">
                OM
              </div>
              <span className="hidden sm:inline text-lg font-semibold text-orbit-50">OrbitMem</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1 sm:ml-6">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const isActive = currentPath.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                      isActive
                        ? "bg-orbit-700 text-orbit-50"
                        : "text-orbit-300 hover:text-orbit-100 hover:bg-orbit-700/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                className="sm:hidden p-2 rounded-lg text-orbit-300 hover:text-orbit-50 hover:bg-orbit-700/50 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <HiOutlineX className="w-5 h-5" />
                ) : (
                  <HiOutlineMenu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileOpen && (
          <nav className="sm:hidden border-t border-orbit-700 bg-orbit-800 px-4 pb-4 pt-2 space-y-1">
            {navLinks.map(({ to, label, icon: Icon }) => {
              const isActive = currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-orbit-700 text-orbit-50"
                      : "text-orbit-300 hover:text-orbit-100 hover:bg-orbit-700/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-orbit-700 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-orbit-400">
              <div className="w-6 h-6 rounded bg-accent-500 flex items-center justify-center text-white font-bold text-[10px]">
                OM
              </div>
              <span>OrbitMem — Sovereign Data Layer for the Agentic Web</span>
            </div>
            <div className="flex items-center gap-2 text-orbit-400 text-sm">
              <a
                href="https://github.com/oboroxyz/orbitmem"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-orbit-200 transition-colors inline-flex items-center gap-1.5"
              >
                <FiGithub className="text-base" />
              </a>
              <span>・</span>
              <a
                href="https://github.com/ethereum/ERCs/blob/master/ERCS/erc-8004.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-orbit-200 transition-colors"
              >
                ERC-8004
              </a>
              <span>・</span>
              <a
                href="https://erc8128.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-orbit-200 transition-colors"
              >
                ERC-8128
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

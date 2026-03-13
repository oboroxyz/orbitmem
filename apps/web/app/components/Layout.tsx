import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { ConnectButton } from "./ConnectButton";

const navLinks = [
  { to: "/explore", label: "Explore" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 sticky top-0 z-50 bg-stone-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-6">
            <Link to="/" className="font-mono text-sm font-medium tracking-tight">
              <img
                src="/logo.png"
                alt="OrbitMem Logo"
                className="w-7 h-7 inline-block mr-1 rounded"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1 ml-6">
              {navLinks.map(({ to, label }) => {
                const isActive = currentPath.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-stone-100 ${
                      isActive ? "text-stone-900 font-medium" : "text-stone-500"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:block">
                <ConnectButton />
              </div>
              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                className="sm:hidden p-2 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  role="img"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                >
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 9h16.5m-16.5 6.75h16.5"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileOpen && (
          <nav className="sm:hidden border-t border-stone-200 px-4 pb-4 pt-2 space-y-1">
            {navLinks.map(({ to, label }) => {
              const isActive = currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-stone-200 text-stone-900"
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="pt-2">
              <ConnectButton />
            </div>
          </nav>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-center gap-4 text-sm text-stone-9000">
          <a
            href="https://github.com/oboroxyz/orbitmem"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-600 transition-colors"
          >
            GitHub
          </a>
          <span className="text-stone-300">&middot;</span>
          <a
            href="https://github.com/ethereum/ERCs/blob/master/ERCS/erc-8004.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-600 transition-colors"
          >
            ERC-8004
          </a>
          <span className="text-stone-300">&middot;</span>
          <a
            href="https://erc8128.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-600 transition-colors"
          >
            ERC-8128
          </a>
        </div>
      </footer>
    </div>
  );
}

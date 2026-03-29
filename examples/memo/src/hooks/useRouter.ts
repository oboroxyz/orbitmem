import { useCallback, useSyncExternalStore } from "react";

export type Route =
  | { page: "list" }
  | { page: "new" }
  | { page: "edit"; id: string }
  | { page: "public"; address: string; memoId: string };

function getHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

function parseHash(hash: string): Route {
  if (hash === "/new") return { page: "new" };

  const editMatch = hash.match(/^\/edit\/([a-zA-Z0-9_-]+)$/);
  if (editMatch) return { page: "edit", id: editMatch[1] };

  const publicMatch = hash.match(/^\/(0x[a-fA-F0-9]+)\/([a-zA-Z0-9_-]+)$/);
  if (publicMatch) return { page: "public", address: publicMatch[1], memoId: publicMatch[2] };

  return { page: "list" };
}

// External store for hash — triggers re-render on navigation
let currentHash = getHash();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return currentHash;
}

function notify() {
  currentHash = getHash();
  for (const cb of listeners) cb();
}

// Listen for hash changes (back/forward + manual hash edits)
window.addEventListener("hashchange", notify);

export function navigate(path: string) {
  const current = getHash();
  if (path === current) return;
  window.location.hash = path;
}

export function useRouter() {
  const hash = useSyncExternalStore(subscribe, getSnapshot);
  const route = parseHash(hash);

  const go = useCallback((path: string) => navigate(path), []);

  return { route, go };
}

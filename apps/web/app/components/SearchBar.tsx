import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

export function SearchBar({
  placeholder = "Search...",
  onSearch,
  debounceMs = 300,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [value, debounceMs, onSearch]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="w-full sm:w-80 rounded-lg px-4 py-2 text-sm text-stone-900 focus:outline-none transition-colors border border-stone-300 bg-stone-100 focus:border-stone-400"
    />
  );
}

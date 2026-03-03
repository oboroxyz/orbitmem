import { type ReactNode, useMemo, useState } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => number | string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
}

export function DataTable<T>({ data, columns, keyExtractor, emptyMessage }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    const sv = col.sortValue;
    return [...data].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, columns, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-8 text-center text-orbit-400">
        {emptyMessage ?? "No data available"}
      </div>
    );
  }

  return (
    <div className="bg-orbit-800 rounded-xl border border-orbit-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orbit-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-orbit-400 uppercase tracking-wider ${
                    col.sortable ? "cursor-pointer hover:text-orbit-200 select-none" : ""
                  }`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span>{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-orbit-700/50">
            {sorted.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-orbit-700/30 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-orbit-100">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

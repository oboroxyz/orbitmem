import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { DataTable } from "../../components/DataTable";
import { SearchBar } from "../../components/SearchBar";
import { type DataRegistration, getDataStats, searchData } from "../../lib/api";

export const Route = createFileRoute("/explore/")({
  component: DataPage,
});

function DataPage() {
  const [schema, setSchema] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dataStats"],
    queryFn: getDataStats,
    refetchInterval: 60_000,
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ["dataSearch", schema, verifiedOnly],
    queryFn: () =>
      searchData({
        schema: schema || undefined,
        verifiedOnly: verifiedOnly || undefined,
      }),
  });

  const entries = result?.results ?? [];

  const onSearch = useCallback((q: string) => setSchema(q), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Explore</h1>
        <p className="text-sm">Browse data entries with quality scores and tags</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-stone-100 p-5">
          <p className="text-xs text-stone-900 mb-1">Data Entries</p>
          <p className="text-2xl font-bold">{statsLoading ? "—" : (stats?.totalEntries ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-stone-100 p-5">
          <p className="text-xs text-stone-900 mb-1">Feedback Submitted</p>
          <p className="text-2xl font-bold">{statsLoading ? "—" : (stats?.totalFeedback ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-stone-100 p-5">
          <p className="text-xs text-stone-900 mb-1">Avg Quality</p>
          <p className="text-2xl font-bold">{statsLoading ? "—" : (stats?.avgQuality ?? 0)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <SearchBar placeholder="Search by schema..." onSearch={onSearch} />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="rounded"
          />
          Verified only
        </label>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading data entries...</div>
      ) : (
        <DataTable<DataRegistration>
          data={entries}
          keyExtractor={(d) => d.dataId}
          emptyMessage="No data entries found. Start the relay to seed data."
          columns={[
            {
              key: "id",
              header: "ID",
              render: (d) => <span className="font-mono">#{d.dataId}</span>,
              sortable: true,
              sortValue: (d) => d.dataId,
            },
            {
              key: "name",
              header: "Name",
              render: (d) => (
                <a
                  href={`/data/${d.dataId}`}
                  className="text-violet-400 hover:underline font-medium"
                >
                  {d.name}
                </a>
              ),
            },
            {
              key: "schema",
              header: "Schema",
              render: (d) =>
                d.schema ? (
                  <span className="px-2 py-0.5 rounded-full text-xs">{d.schema}</span>
                ) : (
                  <span className="">-</span>
                ),
            },
            {
              key: "tags",
              header: "Tags",
              render: (d) => (
                <div className="flex flex-wrap gap-1">
                  {d.tags.map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-violet-600/20 text-violet-400 text-xs"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ),
            },
            {
              key: "visibility",
              header: "Visibility",
              render: (d) => (
                <span
                  className={`text-xs ${d.visibility === "public" ? "text-green-500" : "text-yellow-500"}`}
                >
                  {d.visibility}
                </span>
              ),
            },
            {
              key: "updated",
              header: "Updated",
              render: (d) => (
                <span className="text-xs text-stone-500">
                  {new Date(d.lastUpdated).toLocaleDateString()}
                </span>
              ),
              sortable: true,
              sortValue: (d) => d.lastUpdated,
            },
          ]}
        />
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { DataTable } from "../../components/DataTable";
import { SearchBar } from "../../components/SearchBar";
import { type DataRegistration, searchData } from "../../lib/api";

export const Route = createFileRoute("/data/")({
  component: DataPage,
});

function DataPage() {
  const [schema, setSchema] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

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
        <h1 className="text-2xl font-bold text-orbit-50 mb-1">Data Registry</h1>
        <p className="text-orbit-400 text-sm">Browse data entries with quality scores and tags</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <SearchBar placeholder="Search by schema..." onSearch={onSearch} />
        <label className="flex items-center gap-2 text-sm text-orbit-300 cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="rounded border-orbit-600 bg-orbit-700 text-accent-500 focus:ring-accent-500/50"
          />
          Verified only
        </label>
      </div>

      {isLoading ? (
        <div className="text-center text-orbit-400 py-12">Loading data entries...</div>
      ) : (
        <DataTable<DataRegistration>
          data={entries}
          keyExtractor={(d) => d.dataId}
          emptyMessage="No data entries found. Start the relay to seed data."
          columns={[
            {
              key: "id",
              header: "ID",
              render: (d) => <span className="text-orbit-400 font-mono">#{d.dataId}</span>,
              sortable: true,
              sortValue: (d) => d.dataId,
            },
            {
              key: "name",
              header: "Name",
              render: (d) => (
                <a
                  href={`/data/${d.dataId}`}
                  className="text-accent-300 hover:underline font-medium"
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
                  <span className="px-2 py-0.5 rounded-full bg-orbit-700 text-orbit-200 text-xs">
                    {d.schema}
                  </span>
                ) : (
                  <span className="text-orbit-500">-</span>
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
                      className="px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-300 text-xs"
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
                  className={`text-xs ${d.visibility === "public" ? "text-trust-high" : "text-trust-mid"}`}
                >
                  {d.visibility}
                </span>
              ),
            },
            {
              key: "updated",
              header: "Updated",
              render: (d) => (
                <span className="text-xs text-orbit-400">
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

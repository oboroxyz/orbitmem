import type { Memo } from "../hooks/useOrbitMem";

interface MemoListProps {
  memos: Memo[];
  address: string;
  onSelect: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function MemoList({ memos, address, onSelect, onDelete, onNew }: MemoListProps) {
  const copyShareUrl = (memo: Memo) => {
    const url = `${window.location.origin}/${address}/${memo.id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">My Memos</h2>
        <button
          onClick={onNew}
          className="px-3 py-1.5 hover:bg-gray-100 border-2 transition-colors"
        >
          New Memo
        </button>
      </div>

      {memos.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No memos yet. Create your first one!</p>
      ) : (
        <ul className="space-y-3">
          {memos.map((memo) => (
            <li
              key={memo.id}
              className="border rounded-lg p-4 bg-white hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => onSelect(memo)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{memo.title || "Untitled"}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      memo.visibility === "public"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {memo.visibility}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(memo.updated).toLocaleDateString()}
                  </span>
                  {memo.visibility === "public" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyShareUrl(memo);
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                      title="Copy share URL"
                    >
                      Share
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(memo.id);
                    }}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

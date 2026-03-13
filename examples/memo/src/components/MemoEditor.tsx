import { nanoid } from "nanoid";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Memo } from "../hooks/useOrbitMem";

interface MemoEditorProps {
  memo?: Memo;
  onSave: (memo: {
    id: string;
    title: string;
    body: string;
    visibility: "public" | "private";
    created?: number;
  }) => Promise<void>;
  onBack: () => void;
}

export function MemoEditor({ memo, onSave, onBack }: MemoEditorProps) {
  const [title, setTitle] = useState(memo?.title ?? "");
  const [body, setBody] = useState(memo?.body ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(
    memo?.visibility ?? "public",
  );
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        id: memo?.id ?? nanoid(),
        title,
        body,
        visibility,
        created: memo?.created,
      });
      onBack();
    } catch (e) {
      alert(`Save failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span>Visibility:</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "private")}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold border-0 border-b pb-2 mb-4 focus:outline-none focus:border-blue-500"
      />

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setPreview(false)}
          className={`text-sm px-3 py-1 rounded ${!preview ? "bg-gray-200" : "hover:bg-gray-100"}`}
        >
          Edit
        </button>
        <button
          onClick={() => setPreview(true)}
          className={`text-sm px-3 py-1 rounded ${preview ? "bg-gray-200" : "hover:bg-gray-100"}`}
        >
          Preview
        </button>
      </div>

      {preview ? (
        <div className="prose max-w-none min-h-[300px] p-4 border rounded-md bg-white">
          <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
        </div>
      ) : (
        <textarea
          placeholder="Write your memo in Markdown..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[300px] p-4 border rounded-md font-mono text-sm resize-y focus:outline-none focus:border-blue-500"
        />
      )}

      {memo && (
        <div className="mt-4 text-xs text-gray-400">
          Created: {new Date(memo.created).toLocaleString()} | Updated:{" "}
          {new Date(memo.updated).toLocaleString()}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readPublic } from "../lib/relay";

interface PublicMemoViewProps {
  address: string;
  memoId: string;
}

export function PublicMemoView({ address, memoId }: PublicMemoViewProps) {
  const [title, setTitle] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [titleRes, bodyRes, createdRes] = await Promise.all([
          readPublic(address, `memos/${memoId}/title`),
          readPublic(address, `memos/${memoId}/body`),
          readPublic(address, `memos/${memoId}/created`),
        ]);

        if (!titleRes || !bodyRes) {
          setError("This memo is private or does not exist.");
          return;
        }

        setTitle(titleRes.value as string);
        setBody(bodyRes.value as string);
        setCreated(createdRes?.value as number | null);
      } catch {
        setError("Failed to load memo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [address, memoId]);

  if (loading) {
    return <p className="text-center py-12 text-gray-500">Loading...</p>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error}</p>
        <a href="/" className="text-blue-600 hover:underline">
          Go to OrbitMem Memo
        </a>
      </div>
    );
  }

  const copyUrl = () => navigator.clipboard.writeText(window.location.href);

  return (
    <article className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <div className="flex items-center gap-3 mb-6 text-sm text-gray-500">
        <span className="font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        {created && <span>{new Date(created).toLocaleDateString()}</span>}
        <button onClick={copyUrl} className="text-blue-600 hover:underline">
          Copy link
        </button>
      </div>
      <div className="prose max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>{body ?? ""}</Markdown>
      </div>
    </article>
  );
}

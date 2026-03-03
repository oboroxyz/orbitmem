import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount } from "wagmi";
import { submitFeedback } from "../lib/api";
import { createErc8128Headers } from "../lib/erc8128";

interface FeedbackFormProps {
  dataId: number;
}

const QUALITY_DIMENSIONS = ["accuracy", "completeness", "freshness"] as const;

export function FeedbackForm({ dataId }: FeedbackFormProps) {
  const { isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(75);
  const [dimension, setDimension] = useState<string>("accuracy");
  const [tag1, setTag1] = useState("");
  const [tag2, setTag2] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const headers = await createErc8128Headers("POST", `/api/data/${dataId}/feedback`);
      return submitFeedback(
        dataId,
        {
          value,
          qualityDimension: dimension,
          tag1: tag1 || undefined,
          tag2: tag2 || undefined,
        },
        headers,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataScore", dataId] });
    },
  });

  if (!isConnected) {
    return (
      <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6 text-center">
        <p className="text-orbit-300">Connect your wallet to submit feedback</p>
      </div>
    );
  }

  return (
    <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6">
      <h3 className="text-lg font-semibold text-orbit-50 mb-4">Rate this data</h3>

      <div className="space-y-4">
        {/* Score slider */}
        <div>
          <label htmlFor="feedback-score" className="block text-sm text-orbit-300 mb-1">
            Score: <span className="font-semibold text-orbit-50">{value}</span>
          </label>
          <input
            id="feedback-score"
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-accent-500"
          />
        </div>

        {/* Dimension */}
        <div>
          <label htmlFor="feedback-dimension" className="block text-sm text-orbit-300 mb-1">
            Quality Dimension
          </label>
          <select
            id="feedback-dimension"
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="w-full bg-orbit-700 border border-orbit-600 rounded-lg px-3 py-2 text-orbit-50 text-sm"
          >
            {QUALITY_DIMENSIONS.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="feedback-tag1" className="block text-sm text-orbit-300 mb-1">
              Tag 1
            </label>
            <input
              id="feedback-tag1"
              type="text"
              value={tag1}
              onChange={(e) => setTag1(e.target.value)}
              placeholder="e.g. reliable"
              className="w-full bg-orbit-700 border border-orbit-600 rounded-lg px-3 py-2 text-orbit-50 text-sm placeholder:text-orbit-500"
            />
          </div>
          <div>
            <label htmlFor="feedback-tag2" className="block text-sm text-orbit-300 mb-1">
              Tag 2
            </label>
            <input
              id="feedback-tag2"
              type="text"
              value={tag2}
              onChange={(e) => setTag2(e.target.value)}
              placeholder="e.g. accurate"
              className="w-full bg-orbit-700 border border-orbit-600 rounded-lg px-3 py-2 text-orbit-50 text-sm placeholder:text-orbit-500"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full px-4 py-2 rounded-lg bg-accent-500 text-white font-medium hover:bg-accent-400 transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? "Submitting..." : "Submit Feedback"}
        </button>

        {mutation.isSuccess && (
          <p className="text-sm text-trust-high">Feedback submitted successfully!</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-trust-low">
            Error: {mutation.error instanceof Error ? mutation.error.message : "Unknown error"}
          </p>
        )}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FeedbackForm } from "../../components/FeedbackForm";
import { ScoreCard } from "../../components/ScoreCard";
import { getDataScore } from "../../lib/api";

export const Route = createFileRoute("/explore/$dataId")({
  component: DataDetailPage,
});

function DataDetailPage() {
  const { dataId } = Route.useParams();
  const numId = Number(dataId);

  const { data: score, isLoading } = useQuery({
    queryKey: ["dataScore", numId],
    queryFn: () => getDataScore(numId),
  });

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Link to="/explore" className="hover:text-stone-700 transition-colors">
          Data
        </Link>
        <span>/</span>
        <span className="text-stone-700">#{dataId}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Data Entry #{dataId}</h1>
        <p className="text-stone-600">Quality score breakdown and feedback</p>
      </div>

      {isLoading ? (
        <div className="text-center text-stone-500 py-12">Loading score data...</div>
      ) : score ? (
        <>
          {/* Score gauges */}
          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Quality Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <ScoreCard
                label="Overall Quality"
                score={score.quality}
                feedbackCount={score.totalFeedback}
              />
              <ScoreCard
                label="Accuracy"
                score={score.accuracy.score}
                feedbackCount={score.accuracy.feedbackCount}
              />
              <ScoreCard
                label="Completeness"
                score={score.completeness.score}
                feedbackCount={score.completeness.feedbackCount}
              />
              <ScoreCard label="Freshness" score={score.freshness.score} />
            </div>
          </section>

          {/* Verification */}
          <section className="bg-stone-100 rounded-xl border border-stone-200 p-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full ${score.verified ? "bg-green-500" : "bg-stone-400"}`}
              />
              <span className="text-sm text-stone-700">
                {score.verified
                  ? `Verified via ${score.verificationMethod ?? "on-chain"}`
                  : "Not verified"}
              </span>
              <span className="text-sm text-stone-9000 ml-auto">
                {score.consumptionCount} reads | {score.totalFeedback} ratings
              </span>
            </div>
          </section>

          {/* Tag scores */}
          {Object.keys(score.tagScores).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-stone-900 mb-4">Tag Scores</h2>
              <div className="bg-stone-100 rounded-xl border border-stone-200 divide-y divide-stone-200">
                {Object.entries(score.tagScores).map(([tag, { value, count }]) => (
                  <div key={tag} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-stone-700">{tag}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-500">{count} ratings</span>
                      <div className="w-32 h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${value}%`,
                            backgroundColor:
                              value >= 80 ? "#22c55e" : value >= 50 ? "#eab308" : "#ef4444",
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-stone-800 w-8 text-right">
                        {value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="text-center text-stone-500 py-12">
          No score data available. Start the relay and seed data to see scores.
        </div>
      )}

      {/* Feedback form */}
      <section>
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Submit Feedback</h2>
        <FeedbackForm dataId={numId} />
      </section>
    </div>
  );
}

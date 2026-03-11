import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

interface ScoreCardProps {
  label: string;
  score: number;
  feedbackCount?: number;
}

function scoreColorHex(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

export function ScoreCard({ label, score, feedbackCount }: ScoreCardProps) {
  const color = scoreColorHex(score);
  const data = [{ value: score, fill: color }];

  return (
    <div className="bg-stone-100 rounded-xl border border-stone-200 p-4 flex flex-col items-center gap-2">
      <span className="text-sm text-stone-600 font-medium">{label}</span>
      <div className="w-24 h-24">
        <ResponsiveContainer>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={data}
            barSize={8}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "#e7e5e4" }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <span className="text-2xl font-bold" style={{ color }}>
        {score}
      </span>
      {feedbackCount !== undefined && (
        <span className="text-xs text-stone-500">{feedbackCount} ratings</span>
      )}
    </div>
  );
}

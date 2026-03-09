interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md";
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500/20 text-green-500";
  if (score >= 50) return "bg-yellow-500/20 text-yellow-500";
  return "bg-red-500/20 text-red-500";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const sizeClass = size === "md" ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${scoreColor(score)} ${sizeClass}`}
    >
      {score}
    </span>
  );
}

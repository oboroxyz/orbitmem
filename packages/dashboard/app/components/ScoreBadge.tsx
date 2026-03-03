interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md";
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-trust-high/20 text-trust-high";
  if (score >= 50) return "bg-trust-mid/20 text-trust-mid";
  return "bg-trust-low/20 text-trust-low";
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

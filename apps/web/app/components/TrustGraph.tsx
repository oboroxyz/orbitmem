import { useEffect, useRef } from "react";

interface TrustNode {
  id: string;
  label: string;
  type: "user" | "agent" | "data";
  score: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface TrustEdge {
  source: string;
  target: string;
  score: number;
}

interface TrustGraphProps {
  nodes: TrustNode[];
  edges: TrustEdge[];
  width?: number;
  height?: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

function nodeTypeColor(type: TrustNode["type"]): string {
  switch (type) {
    case "user":
      return "#8b5cf6";
    case "agent":
      return "#3b82f6";
    case "data":
      return "#14b8a6";
  }
}

// Simple force-directed layout using canvas
export function TrustGraph({
  nodes: initialNodes,
  edges,
  width = 600,
  height = 400,
}: TrustGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<TrustNode[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    // Initialize node positions randomly
    nodesRef.current = initialNodes.map((n) => ({
      ...n,
      x: n.x ?? Math.random() * width * 0.6 + width * 0.2,
      y: n.y ?? Math.random() * height * 0.6 + height * 0.2,
      vx: 0,
      vy: 0,
    }));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    function simulate() {
      const nodes = nodesRef.current;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = (a.x ?? 0) - (b.x ?? 0);
          const dy = (a.y ?? 0) - (b.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx = (a.vx ?? 0) + fx;
          a.vy = (a.vy ?? 0) + fy;
          b.vx = (b.vx ?? 0) - fx;
          b.vy = (b.vy ?? 0) - fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;
        const dx = (target.x ?? 0) - (source.x ?? 0);
        const dy = (target.y ?? 0) - (source.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx = (source.vx ?? 0) + fx;
        source.vy = (source.vy ?? 0) + fy;
        target.vx = (target.vx ?? 0) - fx;
        target.vy = (target.vy ?? 0) - fy;
      }

      // Center gravity
      for (const node of nodes) {
        node.vx = (node.vx ?? 0) + (width / 2 - (node.x ?? 0)) * 0.005;
        node.vy = (node.vy ?? 0) + (height / 2 - (node.y ?? 0)) * 0.005;
      }

      // Apply velocity with damping
      for (const node of nodes) {
        node.vx = (node.vx ?? 0) * 0.85;
        node.vy = (node.vy ?? 0) * 0.85;
        node.x = Math.max(30, Math.min(width - 30, (node.x ?? 0) + (node.vx ?? 0)));
        node.y = Math.max(30, Math.min(height - 30, (node.y ?? 0) + (node.vy ?? 0)));
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;

        ctx.beginPath();
        ctx.moveTo(source.x ?? 0, source.y ?? 0);
        ctx.lineTo(target.x ?? 0, target.y ?? 0);
        ctx.strokeStyle = `${scoreColor(edge.score)}60`;
        ctx.lineWidth = Math.max(1, edge.score / 30);
        ctx.stroke();

        // Arrow
        const angle = Math.atan2(
          (target.y ?? 0) - (source.y ?? 0),
          (target.x ?? 0) - (source.x ?? 0),
        );
        const arrowLen = 8;
        const midX = ((source.x ?? 0) + (target.x ?? 0)) / 2;
        const midY = ((source.y ?? 0) + (target.y ?? 0)) / 2;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(
          midX - arrowLen * Math.cos(angle - 0.4),
          midY - arrowLen * Math.sin(angle - 0.4),
        );
        ctx.lineTo(
          midX - arrowLen * Math.cos(angle + 0.4),
          midY - arrowLen * Math.sin(angle + 0.4),
        );
        ctx.fillStyle = `${scoreColor(edge.score)}80`;
        ctx.fill();
      }

      // Draw nodes
      for (const node of nodesRef.current) {
        const radius = node.type === "user" ? 12 : node.type === "agent" ? 16 : 14;
        const x = node.x ?? 0;
        const y = node.y ?? 0;

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${nodeTypeColor(node.type)}20`;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = nodeTypeColor(node.type);
        ctx.fill();
        ctx.strokeStyle = scoreColor(node.score);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.font = "10px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#d0d0ff";
        ctx.textAlign = "center";
        ctx.fillText(node.label, x, y + radius + 14);
      }
    }

    function tick() {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(tick);
    }

    tick();

    return () => cancelAnimationFrame(animRef.current);
  }, [initialNodes, edges, width, height]);

  return (
    <div className="rounded-xl border border-amber-50/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Trust Graph</h3>
        <div className="flex items-center gap-4 text-xs text-blue-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
            Users
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
            Agents
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#14b8a6" }} />
            Data
          </span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full rounded-lg"
        style={{ maxWidth: width, aspectRatio: `${width}/${height}` }}
      />
    </div>
  );
}

// Demo data for the home page
export const DEMO_TRUST_NODES: TrustNode[] = [
  { id: "u1", label: "User A", type: "user", score: 85 },
  { id: "u2", label: "User B", type: "user", score: 72 },
  { id: "a1", label: "DataOracle", type: "agent", score: 92 },
  { id: "a2", label: "MemoryBot", type: "agent", score: 78 },
  { id: "a3", label: "Validator", type: "agent", score: 85 },
  { id: "d1", label: "Market Data", type: "data", score: 88 },
  { id: "d2", label: "Sentiment", type: "data", score: 65 },
  { id: "d3", label: "User Prefs", type: "data", score: 91 },
];

export const DEMO_TRUST_EDGES: TrustEdge[] = [
  // Users rate data
  { source: "u1", target: "d1", score: 90 },
  { source: "u1", target: "d2", score: 65 },
  { source: "u2", target: "d3", score: 85 },
  { source: "u2", target: "d1", score: 88 },
  // Agents rate data
  { source: "a1", target: "d1", score: 92 },
  { source: "a1", target: "d2", score: 60 },
  { source: "a2", target: "d3", score: 85 },
  { source: "a3", target: "d1", score: 88 },
  { source: "a3", target: "d2", score: 55 },
];

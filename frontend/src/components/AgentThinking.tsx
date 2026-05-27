"use client";

import { useEffect, useState } from "react";
import { Cpu, Zap, GitBranch, Activity } from "lucide-react";

const STEPS = [
  { icon: Cpu,       label: "Reading your dataset…" },
  { icon: GitBranch, label: "Planning analysis approach…" },
  { icon: Zap,       label: "Writing Python/Pandas code…" },
  { icon: Activity,  label: "Executing & self-correcting…" },
];

export default function AgentThinking({ elapsed }: { elapsed: number }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const { icon: Icon, label } = STEPS[step];

  return (
    <div
      className="flex flex-col items-center gap-4 py-10"
      style={{ color: "var(--text-secondary)" }}
    >
      <div className="relative flex items-center justify-center w-16 h-16">
        <span className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: "var(--accent)" }} />
        <span className="relative flex items-center justify-center w-16 h-16 rounded-full"
          style={{ background: "rgba(34,211,238,0.1)", border: "1.5px solid var(--accent)" }}>
          <Icon size={28} style={{ color: "var(--accent)" }} />
        </span>
      </div>

      <p className="text-sm font-medium animate-pulse">{label}</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Elapsed: {elapsed}s
      </p>

      {/* Animated dots */}
      <div className="flex gap-1.5 mt-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              background: "var(--accent)",
              animationDelay: `${i * 0.15}s`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  );
}

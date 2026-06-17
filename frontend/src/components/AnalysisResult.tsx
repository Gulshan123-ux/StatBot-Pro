"use client";

import { useState } from "react";
import { ChevronRight, BarChart2, Code2, CheckCircle2, AlertCircle } from "lucide-react";
import type { AnalysisResponse } from "@/types";

interface Props {
  result: AnalysisResponse;
}

export default function AnalysisResult({ result }: Props) {
  const [showCode, setShowCode] = useState(false);

  const isError = result.status === "error";

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b"
        style={{ borderColor: "var(--border)", background: isError ? "rgba(239,68,68,0.05)" : "rgba(34,211,238,0.03)" }}>
        {isError
          ? <AlertCircle size={16} className="text-red-400" />
          : <CheckCircle2 size={16} style={{ color: "var(--accent)" }} />}
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: isError ? "#f87171" : "var(--accent)" }}>
          {isError ? "Error" : "Analysis Complete"}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {result.execution_time_ms}ms · {result.iterations} step{result.iterations !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Question */}
        <div className="flex gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <ChevronRight size={15} className="shrink-0 mt-0.5" />
          <span className="italic">{result.question}</span>
        </div>

        {/* Answer or Error */}
        {isError ? (
          <p className="text-sm text-red-400 whitespace-pre-wrap">{result.error}</p>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--text-primary)" }}>
            {result.answer}
          </p>
        )}

        {/* Charts */}
        {result.charts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}>
              <BarChart2 size={13} /> Charts
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.charts.map((c) => (
                <div key={c.filename} className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}>
                  <img
                    src={c.url}
                    alt={c.title}
                    className="w-full object-contain bg-white"
                    style={{ maxHeight: 340 }}
                  />
                  <p className="text-xs px-3 py-2 text-center"
                    style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }}>
                    {c.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Code toggle */}
        {result.code_executed && (
          <div>
            <button
              onClick={() => setShowCode((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              <Code2 size={13} />
              {showCode ? "Hide" : "Show"} executed code
            </button>
            {showCode && (
              <pre className="mt-2 p-4 rounded-xl text-xs overflow-x-auto leading-relaxed"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  fontFamily: "monospace",
                }}>
                {result.code_executed}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

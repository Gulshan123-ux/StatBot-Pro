"use client";

import { Database } from "lucide-react";
import type { DatasetInfo } from "@/types";

interface Props {
  info: DatasetInfo;
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DataPreview({ info }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "rgba(34,211,238,0.03)" }}>
        <Database size={15} style={{ color: "var(--accent)" }} />
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--accent)" }}>
          Dataset Preview
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {info.filename} · {info.rows.toLocaleString()} rows · {info.columns} cols · {fmt(info.size_bytes)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
              <th className="text-left px-4 py-2 font-semibold">Column</th>
              <th className="text-left px-4 py-2 font-semibold">Type</th>
              <th className="text-left px-4 py-2 font-semibold">Nulls</th>
              <th className="text-left px-4 py-2 font-semibold">Sample Values</th>
            </tr>
          </thead>
          <tbody>
            {info.column_details.map((col, i) => (
              <tr key={col.name}
                style={{
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  borderTop: "1px solid var(--border)",
                }}>
                <td className="px-4 py-2 font-mono font-medium"
                  style={{ color: "var(--text-primary)" }}>{col.name}</td>
                <td className="px-4 py-2 font-mono"
                  style={{ color: "var(--accent)", opacity: 0.8 }}>{col.dtype}</td>
                <td className="px-4 py-2" style={{ color: col.null_count > 0 ? "#fbbf24" : "var(--text-muted)" }}>
                  {col.null_count}
                </td>
                <td className="px-4 py-2" style={{ color: "var(--text-muted)" }}>
                  {col.sample_values.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

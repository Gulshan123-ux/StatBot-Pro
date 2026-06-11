"use client";

import { useState } from "react";

export default function Navbar() {
  const [active, setActive] = useState("agent");

  return (
    <nav
      className="relative z-10 flex items-center justify-between px-7 py-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold"
          style={{
            border: "1.5px solid var(--accent)",
            color: "var(--accent)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "-0.5px",
          }}
        >
          SB
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "14px",
            letterSpacing: "0.3px",
          }}
        >
          Statbot<span style={{ color: "var(--accent)" }}>Pro</span>
        </span>
      </div>

      {/* Nav links */}
      <div className="flex gap-1">
        {[
          { id: "agent", label: "AI Agent" },
          { id: "workspace", label: "BI Workspace" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className="px-3 py-1.5 rounded-full text-xs transition-all"
            style={{
              fontFamily: "var(--font-mono)",
              color: active === item.id ? "var(--accent)" : "var(--text-muted)",
              border: active === item.id
                ? "1px solid rgba(34,211,238,0.3)"
                : "1px solid transparent",
              background: active === item.id ? "var(--accent-dim)" : "transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Status */}
      <div
        className="flex items-center gap-2 text-xs"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
          style={{ background: "var(--accent)" }}
        />
        analyst online
      </div>
    </nav>
  );
}
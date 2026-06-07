"use client";

import { useEffect, useState } from "react";
import { PulseIcon, SparkIcon } from "@/components/Icons";

const PHASES = [
  "Preparing the analysis request",
  "Waiting for the backend to inspect the CSV",
  "Formatting the response for the chat timeline",
];

export default function AgentThinking() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveStep((currentStep) => (currentStep + 1) % PHASES.length);
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="panel animate-slide-up animate-sheen rounded-[2rem] p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--cyan-dim)] text-[var(--cyan)]">
          <PulseIcon className="h-5 w-5 animate-pulse-soft" />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--cyan-soft)]">
              <SparkIcon className="h-3.5 w-3.5" />
              Working
            </div>
            <h3 className="mt-3 font-display text-2xl tracking-tight text-[var(--text-primary)]">
              StatBot is processing your question
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              The frontend is waiting on the `/upload-and-ask` route and will append the
              result to the conversation as soon as the response returns.
            </p>
          </div>

          <div className="grid gap-3">
            {PHASES.map((phase, index) => {
              const isActive = index === activeStep;

              return (
                <div
                  key={phase}
                  className={`rounded-2xl border px-4 py-3 transition ${
                    isActive
                      ? "border-[var(--border-bright)] bg-[rgba(97,231,255,0.08)] text-[var(--text-primary)]"
                      : "border-[var(--border)] bg-[var(--bg-overlay)] text-[var(--text-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        isActive ? "bg-[var(--cyan)]" : "bg-[var(--text-muted)]"
                      }`}
                    />
                    <p className="text-sm">{phase}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

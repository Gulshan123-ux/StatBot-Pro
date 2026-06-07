import {
  ChartSquareIcon,
  CheckCircleIcon,
  SparkIcon,
  WarningIcon,
} from "@/components/Icons";
import type { AnalysisResponse } from "@/types";

interface AnalysisResultProps {
  result: AnalysisResponse;
}

export default function AnalysisResult({ result }: AnalysisResultProps) {
  const succeeded = result.status === "success";
  const answer =
    result.answer ||
    (succeeded
      ? "The backend returned a successful response. Full natural-language answers can appear here as the analysis service becomes richer."
      : null);

  return (
    <article className="panel animate-slide-up rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              succeeded
                ? "bg-[var(--success-dim)] text-[var(--success)]"
                : "bg-[rgba(255,122,136,0.12)] text-[var(--rose)]"
            }`}
          >
            {succeeded ? (
              <CheckCircleIcon className="h-5 w-5" />
            ) : (
              <WarningIcon className="h-5 w-5" />
            )}
          </div>

          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              <SparkIcon className="h-3.5 w-3.5 text-[var(--gold)]" />
              {succeeded ? "Analysis response" : "Request issue"}
            </div>
            <h3 className="mt-3 font-display text-xl tracking-tight text-[var(--text-primary)]">
              {succeeded ? "Backend response received" : "The request returned an error"}
            </h3>
            <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
              {result.error ?? answer}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:min-w-[220px]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Status
            </p>
            <p
              className={`mt-2 text-sm ${
                succeeded ? "text-[var(--success)]" : "text-[var(--rose)]"
              }`}
            >
              {result.status}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Iterations
            </p>
            <p className="mt-2 text-sm text-[var(--text-primary)]">{result.iterations}</p>
          </div>

          {typeof result.rows === "number" || typeof result.columns === "number" ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Dataset echo
              </p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">
                {typeof result.rows === "number" ? `${result.rows.toLocaleString()} rows` : ""}
                {typeof result.rows === "number" && typeof result.columns === "number"
                  ? " · "
                  : ""}
                {typeof result.columns === "number" ? `${result.columns} columns` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {result.charts.length > 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(8,18,31,0.72)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <ChartSquareIcon className="h-4 w-4 text-[var(--cyan)]" />
            <p className="font-display text-sm uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Generated charts
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {result.charts.map((chart) => (
              <figure
                key={chart.url}
                className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-overlay)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={chart.url}
                  alt={chart.title || "Generated analysis chart"}
                  className="h-auto w-full object-cover"
                />
                <figcaption className="border-t border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {chart.title || chart.filename || "Chart"}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

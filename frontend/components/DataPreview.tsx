import { ColumnsIcon, DatabaseIcon } from "@/components/Icons";
import type { DatasetInfo } from "@/types";

interface DataPreviewProps {
  info: DatasetInfo;
}

export default function DataPreview({ info }: DataPreviewProps) {
  const columnNames = Array.isArray(info.column_names) ? info.column_names : [];
  const visibleColumns = columnNames.slice(0, 18);
  const remainingColumns = Math.max(columnNames.length - visibleColumns.length, 0);

  return (
    <section className="panel animate-slide-up rounded-[2rem] p-6 sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            <DatabaseIcon className="h-3.5 w-3.5 text-[var(--cyan)]" />
            Dataset preview
          </div>

          <div>
            <h3 className="font-display text-2xl tracking-tight text-[var(--text-primary)]">
              Structure loaded and ready for questions
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              This preview comes directly from the backend and reflects the current CSV shape.
              Once you submit a question, the same file is sent to the analysis endpoint.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Rows
            </p>
            <p className="mt-2 font-display text-2xl text-[var(--text-primary)]">
              {info.rows.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Columns
            </p>
            <p className="mt-2 font-display text-2xl text-[var(--text-primary)]">
              {info.columns}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Preview scope
            </p>
            <p className="mt-2 font-display text-base text-[var(--text-primary)]">
              Headers only
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(8,18,31,0.72)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <ColumnsIcon className="h-4 w-4 text-[var(--gold)]" />
          <p className="font-display text-sm uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            Column names
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {visibleColumns.length > 0 ? (
            visibleColumns.map((columnName) => (
              <span
                key={columnName}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
              >
                {columnName}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-3 py-1.5 text-sm text-[var(--text-secondary)]">
              No column headers were returned for this preview.
            </span>
          )}

          {remainingColumns > 0 ? (
            <span className="rounded-full border border-[var(--border)] bg-[rgba(245,182,87,0.12)] px-3 py-1.5 text-sm text-[var(--gold-soft)]">
              +{remainingColumns} more
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

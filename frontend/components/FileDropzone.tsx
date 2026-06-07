"use client";

import { useRef, useState } from "react";
import type { DatasetInfo } from "@/types";
import {
  CheckCircleIcon,
  CloseIcon,
  FileSheetIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/Icons";

interface FileDropzoneProps {
  file: File | null;
  datasetInfo: DatasetInfo | null;
  onFileAccepted: (file: File, info: DatasetInfo) => void;
  onFileRemoved: () => void;
  onPreview: (file: File) => Promise<DatasetInfo>;
  disabled?: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({
  file,
  datasetInfo,
  onFileAccepted,
  onFileRemoved,
  onPreview,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (disabled || isParsing) {
      return;
    }

    inputRef.current?.click();
  };

  const handleSelectedFile = async (selectedFile: File | undefined) => {
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a CSV file. The current backend preview endpoint expects CSV input.");
      return;
    }

    setError(null);
    setIsParsing(true);

    try {
      const preview = await onPreview(selectedFile);
      onFileAccepted(selectedFile, preview);
    } catch (previewError: unknown) {
      const message =
        previewError instanceof Error
          ? previewError.message
          : "The file could not be previewed.";
      setError(message);
    } finally {
      setIsParsing(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await handleSelectedFile(event.target.files?.[0]);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (disabled || isParsing) {
      return;
    }

    await handleSelectedFile(event.dataTransfer.files?.[0]);
  };

  const zoneClasses = isDragging
    ? "border-[var(--cyan)] bg-[rgba(97,231,255,0.08)] shadow-[var(--shadow-cyan)]"
    : file
      ? "border-[rgba(110,231,183,0.3)] bg-[rgba(110,231,183,0.05)]"
      : "border-[var(--border-bright)] bg-[rgba(12,24,39,0.72)]";

  return (
    <section className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !isParsing) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => void handleDrop(event)}
        className={`panel-soft animate-slide-up rounded-[2rem] border-2 border-dashed p-6 transition duration-200 ${zoneClasses} ${
          disabled || isParsing ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:border-[var(--cyan)]"
        }`}
        aria-disabled={disabled || isParsing}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => void handleInputChange(event)}
          disabled={disabled || isParsing}
        />

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] text-[var(--cyan)]">
              {isParsing ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-bright)] border-t-[var(--cyan)]" />
              ) : (
                <UploadIcon className="h-6 w-6" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl tracking-tight text-[var(--text-primary)]">
                  {file ? "Replace or inspect your dataset" : "Drop in a CSV to get started"}
                </h2>
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Single file upload
                </span>
              </div>

              <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                {isParsing
                  ? "Reading file structure and asking the preview endpoint for dataset metadata."
                  : "The current backend preview route returns rows, columns, and column names. Uploading a new file resets the conversation so the context stays accurate."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
            disabled={disabled || isParsing}
            className="rounded-full border border-[var(--border-bright)] bg-[var(--cyan-dim)] px-4 py-2 text-sm text-[var(--cyan-soft)] transition hover:bg-[rgba(97,231,255,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {file ? "Choose another CSV" : "Browse files"}
          </button>
        </div>
      </div>

      {file && datasetInfo ? (
        <div className="panel-soft animate-slide-up rounded-[1.5rem] px-5 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--cyan-dim)] text-[var(--cyan)]">
                <FileSheetIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm tracking-tight text-[var(--text-primary)]">
                    {file.name}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(110,231,183,0.25)] bg-[var(--success-dim)] px-2 py-0.5 text-[11px] text-[var(--success)]">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Ready
                  </span>
                </div>

                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {formatBytes(file.size)} · {datasetInfo.rows.toLocaleString()} rows ·{" "}
                  {datasetInfo.columns} columns
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onFileRemoved();
              }}
              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-3 py-2 text-xs text-[var(--text-secondary)] transition hover:border-[rgba(255,122,136,0.45)] hover:text-[var(--rose)]"
            >
              <CloseIcon className="h-3.5 w-3.5" />
              Remove file
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-[rgba(255,122,136,0.24)] bg-[rgba(255,122,136,0.08)] px-4 py-3 text-sm text-[var(--rose)]">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}
    </section>
  );
}

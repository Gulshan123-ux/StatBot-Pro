"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, AlertCircle } from "lucide-react";
import type { DatasetInfo } from "@/types";

interface Props {
  onFilesAccepted: (files: File[], infos: DatasetInfo[]) => void;
  onPreview: (file: File) => Promise<DatasetInfo>;
  isLoading: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({ onFilesAccepted, onPreview, isLoading }: Props) {
  const [isParsing, setIsParsing] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [datasetInfos, setDatasetInfos] = useState<DatasetInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      setError(null);
      setIsParsing(true);

      const newFiles: File[] = [];
      const newInfos: DatasetInfo[] = [];

      try {
        for (const file of accepted) {
          // Avoid duplicate files by name
          if (currentFiles.some((f) => f.name === file.name)) continue;
          
          const info = await onPreview(file);
          newFiles.push(file);
          newInfos.push(info);
        }

        const updatedFiles = [...currentFiles, ...newFiles];
        const updatedInfos = [...datasetInfos, ...newInfos];

        setCurrentFiles(updatedFiles);
        setDatasetInfos(updatedInfos);

        if (updatedFiles.length > 0) {
          onFilesAccepted(updatedFiles, updatedInfos);
        }
      } catch (err: any) {
        setError("Failed to parse one or more files. Ensure they are valid UTF-8 CSVs.");
      } finally {
        setIsParsing(false);
      }
    },
    [currentFiles, datasetInfos, onFilesAccepted, onPreview]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".csv"] },
    maxFiles: 5,
    maxSize: 50 * 1024 * 1024, // 50 MB
    disabled: isLoading || isParsing,
  });

  const removeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    const updatedInfos = datasetInfos.filter((_, i) => i !== index);
    setCurrentFiles(updatedFiles);
    setDatasetInfos(updatedInfos);
    onFilesAccepted(updatedFiles, updatedInfos);
  };

  return (
    <div className="relative space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
          ${isDragActive
            ? "border-[var(--cyan)] bg-[var(--cyan-glow)] scale-[1.005]"
            : currentFiles.length > 0
            ? "border-[var(--emerald)]/20 bg-[var(--bg-elevated)]"
            : "border-[var(--border-bright)] hover:border-[var(--cyan)]/40 hover:bg-[var(--cyan-glow)]"
          }
          ${isLoading || isParsing ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}
        `}
        style={{ boxShadow: isDragActive ? "var(--shadow-cyan)" : undefined }}
      >
        <input {...getInputProps()} />

        {isDragActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--cyan)]/5 to-[var(--violet)]/5 pointer-events-none" />
        )}

        <div className="flex flex-col items-center gap-4 py-8 px-6 text-center">
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-300 ${
              isDragActive
                ? "border-[var(--cyan)] bg-[var(--cyan-dim)] text-[var(--cyan)] scale-110"
                : "border-[var(--border-bright)] bg-[var(--bg-overlay)] text-[var(--text-muted)]"
            }`}
          >
            {isParsing ? (
              <div className="w-5 h-5 border-2 border-[var(--cyan)]/30 border-t-[var(--cyan)] rounded-full animate-spin" />
            ) : (
              <UploadCloud size={24} className={isDragActive ? "animate-float" : ""} />
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {isParsing
                ? "Parsing datasets..."
                : isDragActive
                ? "Release to upload files"
                : "Drop one or more CSV files here"}
            </p>
            {!isParsing && !isDragActive && (
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                or{" "}
                <span className="text-[var(--cyan)] hover:underline cursor-pointer font-medium">
                  click to browse
                </span>
                {" "}· supports multiple files (up to 5) for multi-table joins
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Render uploaded files list */}
      {currentFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {currentFiles.map((file, idx) => {
            const info = datasetInfos[idx];
            return (
              <div key={file.name + idx} className="flex items-center gap-3.5 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] relative group">
                <div className="w-9 h-9 rounded-lg bg-[var(--cyan-dim)]/40 border border-[var(--cyan)]/10 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet size={16} className="text-[var(--cyan)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{file.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {info ? `${info.rows.toLocaleString()} rows · ` : ""}{formatBytes(file.size)}
                  </p>
                </div>
                <button
                  onClick={(e) => removeFile(idx, e)}
                  className="text-[var(--text-muted)] hover:text-[var(--rose)] transition-colors p-1 rounded-lg hover:bg-white/5"
                  title="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-3 px-1 text-xs text-[var(--rose)]">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}

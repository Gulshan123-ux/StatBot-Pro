"use client";

import { useEffect, useRef, useState } from "react";
import AgentThinking from "@/components/AgentThinking";
import AnalysisResult from "@/components/AnalysisResult";
import DataPreview from "@/components/DataPreview";
import FileDropzone from "@/components/FileDropzone";
import {
  ChartSquareIcon,
  CpuChipIcon,
  DatabaseIcon,
  SendIcon,
  SparkIcon,
} from "@/components/Icons";
import { analyzeCSV, previewDataset } from "@/lib/api";
import type { AnalysisHistoryItem, DatasetInfo } from "@/types";

const EXAMPLE_QUESTIONS = [
  "Which columns look the most useful for trend analysis?",
  "Summarize the dataset and point out anything unusual.",
  "How many rows and columns are in this file, and what should I explore first?",
  "If this is sales data, what would be the smartest first chart to build?",
];

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [question, setQuestion] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionId] = useState(createLocalId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, isAnalyzing]);

  const handleFileAccepted = (acceptedFile: File, info: DatasetInfo) => {
    setFile(acceptedFile);
    setDatasetInfo(info);
    setHistory([]);
    setQuestion("");
    setNotice(
      `Loaded ${info.rows.toLocaleString()} rows across ${info.columns} columns.`,
    );
  };

  const handleFileRemoved = () => {
    setFile(null);
    setDatasetInfo(null);
    setHistory([]);
    setQuestion("");
    setNotice(null);
  };

  const resetComposerHeight = () => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
  };

  const handleQuestionChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const nextValue = event.target.value;
    setQuestion(nextValue);

    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 168)}px`;
  };

  const handleSubmit = async () => {
    if (!file || !question.trim() || isAnalyzing) {
      return;
    }

    const prompt = question.trim();
    setQuestion("");
    resetComposerHeight();
    setIsAnalyzing(true);
    setNotice(null);

    try {
      const response = await analyzeCSV(file, prompt, sessionId);
      const item: AnalysisHistoryItem = {
        id: createLocalId(),
        question: prompt,
        response,
        timestamp: new Date(),
      };

      setHistory((currentHistory) => [...currentHistory, item]);
      setNotice(
        response.status === "success"
          ? "Analysis complete."
          : "The backend responded, but the analysis did not complete cleanly.",
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "The request could not be completed.";

      setHistory((currentHistory) => [
        ...currentHistory,
        {
          id: createLocalId(),
          question: prompt,
          response: {
            session_id: sessionId,
            status: "error",
            question: prompt,
            charts: [],
            iterations: 0,
            error: message,
          },
          timestamp: new Date(),
        },
      ]);
      setNotice(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const isReadyForQuestions = Boolean(file && datasetInfo);
  const apiTarget =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

  return (
    <div className="grid-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(7,16,28,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-bright)] bg-[var(--cyan-dim)] text-[var(--cyan)] shadow-[var(--shadow-cyan)]">
              <CpuChipIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Analyst Workspace
              </p>
              <h1 className="font-display text-lg tracking-tight text-[var(--text-primary)]">
                StatBot <span className="gradient-text">Pro</span>
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              CSV chat frontend
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--gold-dim)] px-3 py-1 text-xs text-[var(--gold-soft)]">
              API: {apiTarget}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        {history.length === 0 && !isAnalyzing ? (
          <section className="panel animate-slide-up rounded-[2rem] px-6 py-8 sm:px-9 sm:py-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-bright)] bg-[var(--cyan-dim)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--cyan-soft)]">
              <SparkIcon className="h-3.5 w-3.5" />
              Autonomous CSV analyst
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div className="space-y-4">
                <h2 className="font-display text-4xl leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">
                  Ask better questions about your data
                  <span className="block gradient-text">without leaving the browser.</span>
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
                  Upload a CSV, preview its structure, and send natural-language analysis
                  prompts to the FastAPI backend already in this repo. The UI is wired to
                  the current backend shape, so it works even while the agent layer is still
                  being expanded.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] p-4">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cyan-dim)] text-[var(--cyan)]">
                    <DatabaseIcon className="h-4.5 w-4.5" />
                  </div>
                  <p className="font-display text-sm text-[var(--text-primary)]">
                    File preview
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                    Rows, columns, and headers load before you ask anything.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] p-4">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--gold-dim)] text-[var(--gold)]">
                    <ChartSquareIcon className="h-4.5 w-4.5" />
                  </div>
                  <p className="font-display text-sm text-[var(--text-primary)]">
                    Results timeline
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                    Each question stays in the conversation so follow-ups feel grounded.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-overlay)] p-4">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--success-dim)] text-[var(--success)]">
                    <SparkIcon className="h-4.5 w-4.5" />
                  </div>
                  <p className="font-display text-sm text-[var(--text-primary)]">
                    Backend ready
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                    Uses the current `/preview` and `/upload-and-ask` endpoints.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="animate-slide-up">
          <FileDropzone
            file={file}
            datasetInfo={datasetInfo}
            onFileAccepted={handleFileAccepted}
            onFileRemoved={handleFileRemoved}
            onPreview={previewDataset}
            disabled={isAnalyzing}
          />

          {notice ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">{notice}</p>
          ) : null}
        </section>

        {datasetInfo ? <DataPreview info={datasetInfo} /> : null}

        {datasetInfo && history.length === 0 && !isAnalyzing ? (
          <section className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,24,39,0.72)] px-5 py-5 sm:px-6">
            <div className="mb-4 flex items-center gap-2">
              <SparkIcon className="h-4 w-4 text-[var(--gold)]" />
              <p className="font-display text-sm uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                Try asking
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {EXAMPLE_QUESTIONS.map((exampleQuestion) => (
                <button
                  key={exampleQuestion}
                  type="button"
                  onClick={() => setQuestion(exampleQuestion)}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-overlay)] px-4 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]"
                >
                  {exampleQuestion}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {history.length > 0 ? (
          <section className="space-y-6">
            {history.map((item) => (
              <div key={item.id} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-3xl rounded-[1.5rem] rounded-tr-md border border-[var(--border-bright)] bg-[linear-gradient(180deg,rgba(17,38,60,0.92),rgba(10,20,33,0.92))] px-5 py-4 shadow-[var(--shadow-cyan)]">
                    <p className="text-sm leading-7 text-[var(--text-primary)]">
                      {item.question}
                    </p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {item.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <AnalysisResult result={item.response} />
              </div>
            ))}
          </section>
        ) : null}

        {isAnalyzing ? <AgentThinking /> : null}

        <div ref={bottomRef} />
      </main>

      {isReadyForQuestions ? (
        <div className="sticky bottom-0 z-30 border-t border-[var(--border)] bg-[rgba(7,16,28,0.86)] backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(12,24,39,0.96),rgba(9,19,31,0.96))] p-3 shadow-[var(--shadow-cyan)]">
              <div className="flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={handleQuestionChange}
                  onKeyDown={handleKeyDown}
                  disabled={isAnalyzing}
                  rows={1}
                  placeholder="Ask a question about this CSV. Press Enter to send."
                  className="max-h-40 min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-7 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-70"
                />

                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!question.trim() || isAnalyzing}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cyan)] text-[#07101c] transition hover:bg-[var(--cyan-soft)] disabled:cursor-not-allowed disabled:bg-[rgba(138,171,201,0.16)] disabled:text-[var(--text-muted)]"
                >
                  <SendIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-2 flex flex-col gap-1 px-3 text-[11px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
                <span>Current backend accepts one CSV file per analysis request.</span>
                <span>Shift + Enter adds a new line.</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import axios from "axios";
import type { AnalysisResponse, DatasetInfo } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,
});

export async function previewDataset(file: File): Promise<DatasetInfo> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<DatasetInfo>("/api/analysis/preview", form);
  return data;
}

type ProgressCallback = (msg: string, step: number, total: number) => void;

export async function analyzeCSV(
  files: File[],
  question: string,
  sessionId?: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResponse> {
  const file = files[0];
  if (!file) {
    throw new Error("No file provided");
  }

  // simulate progress steps while waiting for the agent
  onProgress?.("Uploading file...", 1, 5);

  const form = new FormData();
  form.append("file", file);
  form.append("question", question);
  if (sessionId) form.append("session_id", sessionId);

  onProgress?.("Agent is analyzing your data...", 2, 5);

  const { data } = await client.post<AnalysisResponse>(
    "/api/analysis/upload-and-ask",
    form
  );

  onProgress?.("Generating response...", 5, 5);

  return data;
}
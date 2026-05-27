import axios from "axios";
import type { AnalysisResponse, DatasetInfo } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120_000, // 2 min — agent can take a while
});

export async function previewDataset(file: File): Promise<DatasetInfo> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<DatasetInfo>("/api/analysis/preview", form);
  return data;
}

export async function analyzeCSV(
  file: File,
  question: string,
  sessionId?: string
): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("question", question);
  if (sessionId) form.append("session_id", sessionId);
  const { data } = await client.post<AnalysisResponse>(
    "/api/analysis/upload-and-ask",
    form
  );
  return data;
}

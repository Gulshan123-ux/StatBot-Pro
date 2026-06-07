import type { AnalysisResponse, DatasetInfo } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The backend returned an unreadable response.");
  }
}

async function request<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

function normalizeDatasetInfo(payload: unknown): DatasetInfo {
  const data =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const inferredColumnNames = Array.isArray(data.column_names)
    ? data.column_names
    : Array.isArray(data.columnNames)
      ? data.columnNames
      : Array.isArray(data.headers)
        ? data.headers
        : [];

  const columnNames = inferredColumnNames
    .map((value) => String(value))
    .filter((value) => value.length > 0);

  const rows =
    typeof data.rows === "number"
      ? data.rows
      : Number(data.rows) || 0;

  const columns =
    typeof data.columns === "number"
      ? data.columns
      : Number(data.columns) || columnNames.length;

  return {
    rows,
    columns,
    column_names: columnNames,
  };
}

export async function previewDataset(file: File): Promise<DatasetInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const payload = await request<unknown>("/api/analysis/preview", formData);

  return normalizeDatasetInfo(payload);
}

export async function analyzeCSV(
  file: File,
  question: string,
  sessionId: string,
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("question", question);

  const payload = await request<Partial<AnalysisResponse> & {
    message?: string;
    rows?: number;
    columns?: number;
  }>("/api/analysis/upload-and-ask", formData);

  return {
    session_id: payload.session_id ?? sessionId,
    status: payload.status ?? "success",
    question: payload.question ?? question,
    answer: payload.answer ?? payload.message,
    charts: Array.isArray(payload.charts) ? payload.charts : [],
    iterations: typeof payload.iterations === "number" ? payload.iterations : 0,
    error: payload.error,
    rows: payload.rows,
    columns: payload.columns,
  };
}

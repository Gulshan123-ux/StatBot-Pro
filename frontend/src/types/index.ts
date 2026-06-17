export interface DatasetColumn {
  name: string;
  dtype: string;
  null_count: number;
  sample_values: string[];
}

export interface DatasetInfo {
  filename: string;
  rows: number;
  columns: number;
  size_bytes: number;
  column_details: DatasetColumn[];
}

export interface ChartInfo {
  filename: string;
  url: string;
  title: string;
}

export type AnalysisStatus = "success" | "error" | "processing";

export interface AnalysisResponse {
  session_id: string;
  status: AnalysisStatus;
  question: string;
  answer?: string;
  charts: ChartInfo[];
  code_executed?: string;
  iterations: number;
  execution_time_ms: number;
  error?: string;
}

export interface AnalysisHistoryItem {
  id: string;
  question: string;
  response: AnalysisResponse;
  timestamp: Date;
}

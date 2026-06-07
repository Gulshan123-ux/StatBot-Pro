export interface DatasetInfo {
  rows: number;
  columns: number;
  column_names: string[];
}

export interface ChartInfo {
  filename?: string;
  url: string;
  title?: string;
}

export interface AnalysisResponse {
  session_id: string;
  status: string;
  question: string;
  answer?: string;
  charts: ChartInfo[];
  iterations: number;
  error?: string;
  rows?: number;
  columns?: number;
}

export interface AnalysisHistoryItem {
  id: string;
  question: string;
  response: AnalysisResponse;
  timestamp: Date;
}

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  maxFileSizeMB: 50,
  maxQuestionLength: 500,
  supportedExtensions: [".csv", ".xlsx", ".xls", ".tsv"],
};

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatBot Pro",
  description:
    "Upload a CSV, ask a question in plain English, and inspect AI-assisted analysis results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full font-body antialiased">{children}</body>
    </html>
  );
}

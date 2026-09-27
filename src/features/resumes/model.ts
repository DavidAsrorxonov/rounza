import { z } from "zod";
export const MAX_TEXT = 100000;
export const MAX_FILE = 5 * 1024 * 1024;
export const MAX_PAGES = 50;
export const PAGE_SIZE = 20;
export const sources = {
  paste: "Pasted text",
  pdf: "PDF import",
  docx: "DOCX import",
} as const;
export const resumeInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give this resume a name.")
    .max(160, "Use at most 160 characters."),
  body: z
    .string()
    .transform((value) => value.replace(/\r\n?/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(1, "Add your resume text.")
        .max(MAX_TEXT, "Use at most 100,000 characters.")
        .refine(
          (value) => !value.includes("\u0000"),
          "Remove null characters from the text.",
        ),
    ),
  source: z.enum(["paste", "pdf", "docx"]),
});
export type ResumeFields = z.infer<typeof resumeInput>;
export type Resume = ResumeFields & {
  id: string;
  user_id: string;
  character_count: number;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type ResumeState = {
  message?: string;
  conflict?: boolean;
  errors?: Partial<Record<keyof ResumeFields | "reviewed", string[]>>;
};
export function resumePage(value?: string) {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1;
}
export function cleanImportedText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
export function fileKind(name: string, size: number): "pdf" | "docx" {
  if (size <= 0)
    throw new Error(
      "This file is empty. Choose another file or paste your text.",
    );
  if (size > MAX_FILE)
    throw new Error(
      "Choose a file smaller than 5 MB, or paste the text instead.",
    );
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (extension !== "pdf" && extension !== "docx")
    throw new Error(
      "Choose a PDF or DOCX file. Older .doc files are not supported; export to DOCX or paste the text.",
    );
  return extension;
}
export function checkedText(text: string) {
  const cleaned = cleanImportedText(text);
  if (!cleaned)
    throw new Error(
      "No readable text was found. Scanned documents and images need OCR elsewhere; paste the resulting text here.",
    );
  if (cleaned.length > MAX_TEXT)
    throw new Error(
      "This document contains more than 100,000 characters. Import a shorter version or paste the relevant text.",
    );
  return cleaned;
}
export type ImportResult = {
  text: string;
  source: "pdf" | "docx";
  warnings: string[];
};

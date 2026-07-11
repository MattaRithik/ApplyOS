import { describe, expect, it } from "vitest";
import {
  MAX_RESUME_FILE_SIZE_BYTES,
  canonicalMimeType,
  isResumeSignatureValid,
  sanitizeOriginalFileName,
} from "@/lib/utils/resume";

describe("resume file hardening", () => {
  it("sanitizes traversal and control-like filename characters", () => {
    const safe = sanitizeOriginalFileName("../../My Résumé<script>.pdf");
    expect(safe).toBe("My_Resumescript.pdf");
    expect(safe).not.toMatch(/[\\/<>]/);
  });

  it("recognizes only the expected file signatures", () => {
    expect(isResumeSignatureValid("pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(isResumeSignatureValid("pdf", new TextEncoder().encode("MZ executable"))).toBe(false);
    expect(isResumeSignatureValid("doc", Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe(true);
    expect(isResumeSignatureValid("docx", Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });

  it("maps each allowed extension to a canonical MIME type and keeps a finite size cap", () => {
    expect(canonicalMimeType("pdf")).toBe("application/pdf");
    expect(canonicalMimeType("docx")).toContain("officedocument");
    expect(MAX_RESUME_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);
  });
});

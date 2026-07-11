"use client";

import type { Resume } from "@/lib/types/database";
import {
  ALLOWED_RESUME_MIME_TYPES,
  MAX_RESUME_FILE_SIZE_BYTES,
  getFileExtension,
  isAllowedResumeExtension,
  canonicalMimeType,
} from "@/lib/utils/resume";

/**
 * Browser-side helpers for the resume lifecycle. None of these talk to
 * storage directly — every call goes through a Next.js API route that
 * verifies the Supabase session and holds the Backblaze B2 credentials
 * server-side. The browser only ever sees short-lived signed URLs.
 */

export class ResumeUploadError extends Error {}

async function readJsonOrThrow(res: Response): Promise<Record<string, unknown>> {
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new ResumeUploadError((json.error as string | undefined) || `Request failed (${res.status})`);
  }
  return json;
}

export async function uploadResume(file: File, displayName?: string): Promise<Resume> {
  const extension = getFileExtension(file.name);
  if (!(file.type in ALLOWED_RESUME_MIME_TYPES) && !isAllowedResumeExtension(extension)) {
    throw new ResumeUploadError("Only PDF, DOC, and DOCX files are allowed.");
  }
  if (!isAllowedResumeExtension(extension)) {
    throw new ResumeUploadError("The file must have a PDF, DOC, or DOCX extension.");
  }
  const uploadContentType = canonicalMimeType(extension);
  if (file.type && file.type !== uploadContentType) {
    throw new ResumeUploadError("The file extension and MIME type do not match.");
  }
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new ResumeUploadError(`File must be under ${MAX_RESUME_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  // 1. Ask the server for a resume row + a short-lived signed B2 PUT URL.
  const createRes = await fetch("/api/resumes/create-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: uploadContentType,
      fileSize: file.size,
      displayName,
    }),
  });
  const { resume_id: resumeId, signed_upload_url: signedUploadUrl } = await readJsonOrThrow(createRes);

  // 2. Upload the file directly to B2 — this request never touches our server.
  const uploadRes = await fetch(signedUploadUrl as string, {
    method: "PUT",
    headers: { "Content-Type": uploadContentType },
    body: file,
  });
  if (!uploadRes.ok) {
    throw new ResumeUploadError("Upload to storage failed. Please try again.");
  }

  // 3. Tell the server the upload landed so it can mark the row "uploaded".
  const finalizeRes = await fetch(`/api/resumes/${resumeId}/finalize`, { method: "POST" });
  const { resume } = await readJsonOrThrow(finalizeRes);
  return resume as unknown as Resume;
}

export async function deleteResume(resumeId: string): Promise<void> {
  const res = await fetch(`/api/resumes/${resumeId}`, { method: "DELETE" });
  await readJsonOrThrow(res);
}

/**
 * `mode: "view"` (default) opens the file in the browser tab — used for the
 * one-click preview. `mode: "download"` forces a save-to-disk instead.
 */
export async function getResumeDownloadUrl(resumeId: string, mode: "view" | "download" = "view"): Promise<string> {
  const disposition = mode === "download" ? "attachment" : "inline";
  const res = await fetch(`/api/resumes/${resumeId}/download-url?disposition=${disposition}`);
  const { url } = await readJsonOrThrow(res);
  return url as string;
}

export async function renameResume(resumeId: string, newDisplayName: string): Promise<Resume> {
  const res = await fetch("/api/resumes/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeId, newDisplayName }),
  });
  const { resume } = await readJsonOrThrow(res);
  return resume as unknown as Resume;
}

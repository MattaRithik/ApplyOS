export const ALLOWED_RESUME_EXTENSIONS = ["pdf", "doc", "docx"] as const;
export type ResumeExtension = (typeof ALLOWED_RESUME_EXTENSIONS)[number];

export const ALLOWED_RESUME_MIME_TYPES: Record<string, ResumeExtension> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export const MAX_RESUME_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function isAllowedResumeExtension(ext: string): ext is ResumeExtension {
  return (ALLOWED_RESUME_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

export function isAllowedResumeMimeType(mimeType: string): mimeType is keyof typeof ALLOWED_RESUME_MIME_TYPES {
  return mimeType in ALLOWED_RESUME_MIME_TYPES;
}

/** Turns a free-form name into a filesystem/storage-safe file name, preserving the extension. */
export function sanitizeToFileName(name: string, extension: string): string {
  const base = name
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);

  const safeBase = base.length > 0 ? base : "resume";
  return `${safeBase}.${extension.toLowerCase()}`;
}

/** Sanitizes the original uploaded file name for use as the trailing segment of a B2 object key. */
export function sanitizeOriginalFileName(originalFileName: string): string {
  const detectedExtension = getFileExtension(originalFileName);
  const extension = detectedExtension || "pdf";
  const base = detectedExtension
    ? originalFileName.slice(0, originalFileName.length - detectedExtension.length - 1)
    : originalFileName;
  return sanitizeToFileName(base, extension);
}

export function canonicalMimeType(extension: ResumeExtension): string {
  const entry = Object.entries(ALLOWED_RESUME_MIME_TYPES).find(([, ext]) => ext === extension);
  if (!entry) throw new Error("Unsupported resume extension.");
  return entry[0];
}

export function isResumeSignatureValid(extension: ResumeExtension, bytes: Uint8Array): boolean {
  if (extension === "pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (extension === "doc") {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    return ole.every((value, index) => bytes[index] === value);
  }
  // DOCX is an OPC document in a ZIP container. This rejects arbitrary
  // executable formats, while deeper document parsing remains out of scope.
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

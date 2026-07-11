import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  NotFound,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ResumeExtension } from "@/lib/utils/resume";
import { isResumeSignatureValid } from "@/lib/utils/resume";

/**
 * Server-only Backblaze B2 client via the S3-compatible API.
 *
 * Credentials never leave the server: this module is guarded by the
 * `server-only` import, so bundling it into a client component fails the
 * build instead of leaking B2_KEY_ID / B2_APPLICATION_KEY to the browser.
 */

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_URL_EXPIRY_SECONDS = 5 * 60;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let cachedClient: S3Client | null = null;

function getB2Client(): S3Client {
  if (cachedClient) return cachedClient;

  cachedClient = new S3Client({
    endpoint: requiredEnv("B2_ENDPOINT"),
    region: requiredEnv("B2_REGION"),
    credentials: {
      accessKeyId: requiredEnv("B2_KEY_ID"),
      secretAccessKey: requiredEnv("B2_APPLICATION_KEY"),
    },
    forcePathStyle: true,
  });

  return cachedClient;
}

function getBucketName(): string {
  return requiredEnv("B2_BUCKET_NAME");
}

/** Object keys are always server-generated — callers never choose the final path. */
export function buildResumeObjectKey(userId: string, resumeId: string, safeFileName: string): string {
  const uuid = crypto.randomUUID();
  return `users/${userId}/resumes/${resumeId}/uploads/${uuid}-${safeFileName}`;
}

/** Final objects never have a browser-minted PUT URL. */
export function buildFinalResumeObjectKey(userId: string, resumeId: string, safeFileName: string): string {
  return `users/${userId}/resumes/${resumeId}/files/${crypto.randomUUID()}-${safeFileName}`;
}

/** Defense in depth for current-format keys; legacy keys remain DB-owned. */
export function assertResumeObjectKeyOwnership(storageKey: string, userId: string): void {
  if (storageKey.includes("..") || storageKey.includes("\\") || /[\u0000-\u001f\u007f]/.test(storageKey)) {
    throw new Error("Invalid storage key.");
  }
  if (storageKey.startsWith("users/") && !storageKey.startsWith(`users/${userId}/resumes/`)) {
    throw new Error("Storage key ownership mismatch.");
  }
}

export async function createResumeUploadUrl(
  storageKey: string,
  contentType: string
): Promise<{ url: string; expiresIn: number }> {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: storageKey,
    ContentType: contentType,
  });
  const url = await getSignedUrl(getB2Client(), command, { expiresIn: UPLOAD_URL_EXPIRY_SECONDS });
  return { url, expiresIn: UPLOAD_URL_EXPIRY_SECONDS };
}

export async function createResumeDownloadUrl(
  storageKey: string,
  downloadFileName?: string,
  disposition: "inline" | "attachment" = "attachment",
  contentType = "application/octet-stream"
): Promise<{ url: string; expiresIn: number }> {
  const safeName = downloadFileName
    ?.normalize("NFKC")
    .replace(/[\r\n"\\/\u0000-\u001f\u007f]/g, "_")
    .slice(0, 180);
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: storageKey,
    ResponseContentDisposition: safeName
      ? `${disposition}; filename="${safeName}"`
      : undefined,
    ResponseContentType: contentType,
  });
  const url = await getSignedUrl(getB2Client(), command, { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS });
  return { url, expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS };
}

/** Confirms the direct browser -> B2 PUT actually landed before we mark a resume "uploaded". */
export interface ResumeObjectInspection {
  exists: boolean;
  size?: number;
  contentType?: string;
  signatureValid?: boolean;
  eTag?: string;
}

export async function inspectResumeObject(
  storageKey: string,
  extension: ResumeExtension
): Promise<ResumeObjectInspection> {
  try {
    const result = await getB2Client().send(
      new HeadObjectCommand({ Bucket: getBucketName(), Key: storageKey })
    );
    const prefix = await getB2Client().send(
      new GetObjectCommand({ Bucket: getBucketName(), Key: storageKey, Range: "bytes=0-7" })
    );
    const bytes = prefix.Body ? await prefix.Body.transformToByteArray() : new Uint8Array();
    return {
      exists: true,
      size: result.ContentLength,
      contentType: result.ContentType,
      signatureValid: isResumeSignatureValid(extension, bytes),
      eTag: result.ETag,
    };
  } catch (e) {
    if (e instanceof NotFound) return { exists: false };
    const meta = (e as { $metadata?: { httpStatusCode?: number } }).$metadata;
    if (meta?.httpStatusCode === 404) return { exists: false };
    throw e;
  }
}

/**
 * Copies a validated temporary upload to an unguessable final key. The
 * ETag precondition closes the race between inspection and promotion: if
 * the signed PUT URL replaced the temp object, the copy fails.
 */
export async function promoteResumeObject(
  sourceKey: string,
  destinationKey: string,
  sourceETag: string,
  contentType: string
): Promise<void> {
  await getB2Client().send(
    new CopyObjectCommand({
      Bucket: getBucketName(),
      Key: destinationKey,
      CopySource: encodeURIComponent(`${getBucketName()}/${sourceKey}`).replace(/%2F/g, "/"),
      CopySourceIfMatch: sourceETag,
      ContentType: contentType,
      MetadataDirective: "REPLACE",
    })
  );
}

export async function deleteResumeObject(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: storageKey,
  });
  await getB2Client().send(command);
}

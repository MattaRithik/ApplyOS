import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  return `users/${userId}/resumes/${resumeId}/${uuid}-${safeFileName}`;
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
  disposition: "inline" | "attachment" = "attachment"
): Promise<{ url: string; expiresIn: number }> {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: storageKey,
    ResponseContentDisposition: downloadFileName
      ? `${disposition}; filename="${downloadFileName.replace(/"/g, "")}"`
      : undefined,
  });
  const url = await getSignedUrl(getB2Client(), command, { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS });
  return { url, expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS };
}

/** Confirms the direct browser -> B2 PUT actually landed before we mark a resume "uploaded". */
export async function resumeObjectExists(storageKey: string): Promise<{ exists: boolean; size?: number }> {
  try {
    const result = await getB2Client().send(
      new HeadObjectCommand({ Bucket: getBucketName(), Key: storageKey })
    );
    return { exists: true, size: result.ContentLength };
  } catch (e) {
    if (e instanceof NotFound) return { exists: false };
    const meta = (e as { $metadata?: { httpStatusCode?: number } }).$metadata;
    if (meta?.httpStatusCode === 404) return { exists: false };
    throw e;
  }
}

export async function deleteResumeObject(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: storageKey,
  });
  await getB2Client().send(command);
}

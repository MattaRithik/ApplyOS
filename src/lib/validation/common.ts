import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const optionalUuidSchema = uuidSchema.nullable().optional();
export const shortTextSchema = z.string().trim().min(1).max(200);
export const optionalTextSchema = (max = 2_000) => z.string().trim().max(max).nullable().optional();
export const isoDateSchema = z.iso.date();
export const optionalIsoDateSchema = isoDateSchema.nullable().optional();

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "https:" || protocol === "http:";
    } catch {
      return false;
    }
  }, "Only HTTP(S) URLs are allowed.");

export const optionalHttpUrlSchema = httpUrlSchema.nullable().optional();

/** Runtime mass-assignment guard for typed server-action objects. */
export function assertAllowedKeys(value: unknown, allowedKeys: readonly string[]): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid input.");
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("Invalid input fields.");
}
